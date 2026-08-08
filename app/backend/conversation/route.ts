import { NextRequest } from "next/server";
import { tavily } from "@tavily/core";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "../db";
import { syncUser } from "../user";
import type { MessageModel } from "../../generated/prisma/models";

/**
 * POST /backend/conversation
 *
 * Body:  { query: string, conversationId?: string }
 * Reply: a streamed text body (see SOURCE_DELIMITER below) plus an
 *        `X-Conversation-Id` header naming the thread this turn belongs to.
 *
 * Flow:
 *   1. Identify the signed-in user and mirror them into our `User` table.
 *   2. Open the thread — continue `conversationId`, or start a new one.
 *   3. Save the user's question as a `Message`.
 *   4. Search the web using Tavily with includeAnswer:true to get both
 *      an AI-generated answer and web sources in one call.
 *   5. Stream the answer back, append the sources, and save the answer.
 *
 * Every failure path returns `{ detail: "..." }` with a non-2xx status, which
 * is the shape `app/page.tsx` reads when it shows the red error banner.
 */

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

// Tavily is the web-search + answer provider.
const search = tavily({ apiKey: process.env.TAVILY_API_KEY });

// Marker written between the answer and the sources so the frontend can
// split the streamed response into its two halves. Keep this in sync with
// the value used in `app/page.tsx`.
const SOURCE_DELIMITER = "\n----------source----------\n";

// How many earlier messages of the thread to keep. Used for context display.
const HISTORY_LIMIT = 20;

// The web results Tavily hands back for one query.
type Sources = Awaited<ReturnType<typeof search.search>>["results"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pull a readable sentence out of whatever was thrown. */
function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}

/** The thread's title: the opening question, trimmed to something displayable. */
function titleFrom(query: string): string {
  return query.length > 80 ? `${query.slice(0, 77)}...` : query;
}

/**
 * A URL-friendly id for the thread, e.g. "who-won-the-2026-world-cup-k3f9pq".
 *
 * `Conversation.slug` is unique, so the random suffix keeps two people asking
 * the same question from colliding.
 */
function slugFrom(query: string): string {
  const base = query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // punctuation and spaces become dashes
    .replace(/^-+|-+$/g, "")     // no leading/trailing dashes
    .slice(0, 60);
  const suffix = Math.random().toString(36).slice(2, 8);
  return base ? `${base}-${suffix}` : suffix;
}

/** Render earlier turns as plain text for context. */
function formatHistory(messages: MessageModel[]): string {
  if (messages.length === 0) {
    return "(This is the first question in this conversation.)";
  }
  return messages
    .map((m) => `${m.role === "User" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");
}

/**
 * Build a streaming response:
 *   - first the Tavily answer text
 *   - then the delimiter
 *   - then each source as JSON
 *
 * `answer` is the full answer string from Tavily.
 * `onAnswerComplete` is called after the stream closes to persist the answer.
 */
function buildStreamingResponse({
  answer,
  sources,
  conversationId,
  onAnswerComplete,
}: {
  answer: string;
  sources: Sources;
  conversationId: string;
  onAnswerComplete: (fullAnswer: string) => Promise<void>;
}): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // 1. Stream the answer in chunks for a realistic streaming feel.
      const chunkSize = 20;
      for (let i = 0; i < answer.length; i += chunkSize) {
        controller.enqueue(encoder.encode(answer.slice(i, i + chunkSize)));
        // Small delay to simulate streaming
        await new Promise((r) => setTimeout(r, 10));
      }

      // 2. Separate the answer from the sources.
      controller.enqueue(encoder.encode(SOURCE_DELIMITER));

      // 3. Append every source so the frontend can list them.
      for (const source of sources) {
        controller.enqueue(encoder.encode(JSON.stringify(source)));
      }

      controller.close();

      // 4. Persist the answer after the stream is closed.
      try {
        await onAnswerComplete(answer);
      } catch (err) {
        console.error("Could not save the assistant message:", err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // Lets the frontend send the next question into this same thread.
      "X-Conversation-Id": conversationId,
    },
  });
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // 1. Validate the incoming query.
  const { query, conversationId } = await req.json();

  if (!query || typeof query !== "string") {
    return Response.json({ detail: "query is required" }, { status: 400 });
  }

  // 2. Identify the caller.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return Response.json(
      { detail: "You must be signed in to search." },
      { status: 401 }
    );
  }

  // 3. Open the thread this turn belongs to, and save the question.
  let dbUser;
  let conversation;
  let history: MessageModel[];

  try {
    dbUser = await syncUser(user);

    conversation =
      typeof conversationId === "string" && conversationId
        ? await prisma.conversation.findFirst({
            where: { id: conversationId, userId: dbUser.id },
          })
        : null;

    if (conversation) {
      history = await prisma.message.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createAt: "desc" },
        take: HISTORY_LIMIT,
      });
      history.reverse();
    } else {
      conversation = await prisma.conversation.create({
        data: {
          title: titleFrom(query),
          slug: slugFrom(query),
          userId: dbUser.id,
        },
      });
      history = [];
    }

    await prisma.message.create({
      data: {
        content: query,
        role: "User",
        conversationId: conversation.id,
      },
    });
  } catch (err) {
    console.error("Could not open the conversation:", err);
    return Response.json(
      { detail: `Could not save the conversation: ${messageOf(err)}` },
      { status: 500 }
    );
  }

  // 4. Search the web using Tavily with includeAnswer:true.
  //    Tavily generates the answer directly from the search results — no LLM needed.
  let sources: Sources;
  let answer: string;

  try {
    // Log history for context (not sent to Tavily, but useful for debugging)
    console.log("Conversation history:", formatHistory(history));

    const { results, answer: tavilyAnswer } = await search.search(query, {
      searchDepth: "advanced",
      includeAnswer: true,
    });

    sources = results;
    answer = tavilyAnswer ?? results.map((r) => r.content).join("\n\n");

    if (!answer || answer.trim() === "") {
      return Response.json(
        { detail: "Tavily could not generate an answer for this query. Please try again." },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error("Web search failed:", err);
    return Response.json(
      { detail: `Web search failed: ${messageOf(err)}` },
      { status: 502 }
    );
  }

  // 5. Stream the answer and sources back, then store the answer.
  const threadId = conversation.id;

  return buildStreamingResponse({
    answer,
    sources,
    conversationId: threadId,
    onAnswerComplete: async (fullAnswer) => {
      await prisma.message.create({
        data: {
          content: fullAnswer,
          role: "Assistant",
          conversationId: threadId,
        },
      });
    },
  });
}
