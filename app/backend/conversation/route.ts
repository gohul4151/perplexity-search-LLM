import { NextRequest } from "next/server";
import { tavily } from "@tavily/core";
import { streamText, Output } from "ai";
import { z } from "zod";
import { SYSTEM_PROMPT, PROMPT_TEMPLATE } from "./prompt";
import { prisma } from "../db";

prisma.user.create({
  data:{
    email:"gohul@gmail.com",
    provider:"Google",
    name:"gohul"
  }
})
/**
 * POST /backend/conversation
 *
 * Flow:
 *   1. Read the user's `query` from the request body.
 *   2. Search the web for that query using Tavily.
 *   3. Ask the LLM to answer the query using those search results.
 *   4. Stream the answer back, then append the raw sources.
 */

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

// Tavily is the web-search provider. It gives us fresh results to feed the LLM.
const search = tavily({ apiKey: process.env.TAVILY_API_KEY });

// The exact JSON shape we want the LLM to return.
const responseSchema = z.object({
  answer: z.string().describe("Final answer to the user's query"),
  followUps: z.array(z.string()).describe("Follow-up questions for the user"),
});

// Marker written between the answer and the sources so the frontend can
// split the streamed response into its two halves. Keep this in sync with
// the value used in `app/page.tsx`.
const SOURCE_DELIMITER = "\n----------source----------\n";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build the final prompt by injecting the query and search results. */
function buildPrompt(query: string, searchResults: unknown): string {
  return PROMPT_TEMPLATE
    .replace("{{USER_QUERY}}", query)
    .replace("{{WEB_SEARCH_RESULTS}}", JSON.stringify(searchResults));
}

/**
 * Build a streaming text response:
 *   - first the LLM answer (streamed as it is generated)
 *   - then the delimiter
 *   - then each source as JSON
 */
function buildStreamingResponse(
  answerStream: AsyncIterable<string>,
  sources: unknown[]
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // 1. Stream the answer chunk by chunk.
      for await (const chunk of answerStream) {
        controller.enqueue(encoder.encode(chunk));
      }

      // 2. Separate the answer from the sources.
      controller.enqueue(encoder.encode(SOURCE_DELIMITER));

      // 3. Append every source so the frontend can list them.
      for (const source of sources) {
        controller.enqueue(encoder.encode(JSON.stringify(source)));
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // 1. Validate the incoming query.
  const { query } = await req.json();

  if (!query || typeof query !== "string") {
    return Response.json({ error: "query is required" }, { status: 400 });
  }

  // 2. Search the web for context.
  const { results: sources } = await search.search(query, {
    searchDepth: "advanced",
  });

  // 3. Ask the LLM to answer using that context.
  const result = streamText({
    model: "openai/gpt-5.4",
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(query, sources),
    output: Output.object({ schema: responseSchema }),
  });

  // 4. Stream the answer, then the sources, back to the client.
  return buildStreamingResponse(result.textStream, sources);
}
