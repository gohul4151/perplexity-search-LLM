"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase/client";

/**
 * Home page for the Perplexity clone.
 *
 * The user types a question -> we call POST /backend/conversation -> the
 * backend streams back a plain-text body shaped like:
 *
 *   {"answer": "...", "followUps": [...]}      <- the LLM answer (JSON)
 *   ----------source----------                 <- delimiter
 *   {source}{source}{source}                   <- the web sources (JSON)
 *
 * This component reads that text, splits it apart, and renders the answer,
 * follow-up questions, and sources.
 */

// One web source returned by the backend.
type Source = {
  title: string;
  url: string;
  content?: string;
};

// Must match the delimiter the backend writes in route.ts.
const SOURCE_DELIMITER = "----------source----------";

// The sources arrive as JSON objects glued together with no separator
// (e.g. `{...}{...}`). This walks the string and pulls out each object,
// keeping track of nested braces and quoted text so it splits correctly.
function parseSources(input: string): Source[] {
  const sources: Source[] = [];
  let depth = 0; // how many `{` we are currently inside
  let start = -1; // index where the current object began
  let inString = false; // are we inside a "quoted string"?
  let escaped = false; // was the previous char a backslash?

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    // Inside a string, ignore braces and watch for the closing quote.
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      if (depth === 0) start = i; // outermost object starts here
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        // We closed a full top-level object -> parse it.
        try {
          sources.push(JSON.parse(input.slice(start, i + 1)));
        } catch {
          // ignore anything that isn't valid JSON
        }
        start = -1;
      }
    }
  }

  return sources;
}

export default function Home() {
  const router = useRouter();

  // The signed-in user's display label (name or email), or null while loading
  // / signed out. Populated from the Supabase session on the client.
  const [userLabel, setUserLabel] = useState<string | null>(null);

  // On mount, read the current Supabase user and keep it in sync if the auth
  // state changes (e.g. the user signs out in another tab).
  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (u) setUserLabel(u.user_metadata?.name ?? u.email ?? "Account");
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      setUserLabel(u ? u.user_metadata?.name ?? u.email ?? "Account" : null);
    });

    // Unsubscribe when the component unmounts.
    return () => sub.subscription.unsubscribe();
  }, []);

  // Sign out of Supabase, then send the user back to the login page.
  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const [query, setQuery] = useState(""); // text in the input box
  const [asked, setAsked] = useState(""); // the question the results belong to
  const [answer, setAnswer] = useState(""); // the LLM answer
  const [followUps, setFollowUps] = useState<string[]>([]); // suggested questions
  const [sources, setSources] = useState<Source[]>([]); // web sources
  const [loading, setLoading] = useState(false); // waiting for the backend?
  const [error, setError] = useState(""); // error message, if any

  // The conversation (thread) the current results belong to. The backend
  // creates it on the first question and returns its id in `X-Conversation-Id`;
  // sending it back threads the next question onto the same stored thread, so
  // the model can see the earlier turns.
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Send a question to the backend and store the parsed response.
  //
  // `continueThread` decides whether this question joins the current thread
  // (clicking a follow-up) or opens a new one (typing in the search box).
  async function runSearch(question: string, continueThread: boolean) {
    const trimmed = question.trim();
    if (!trimmed) return;

    const threadId = continueThread ? conversationId : null;
    if (!continueThread) setConversationId(null);

    // Reset UI before the new search. The input is emptied and the question
    // moves to the results area, so the box is ready for the next question
    // instead of still holding the one we just sent.
    setQuery("");
    setAsked(trimmed);
    setLoading(true);
    setError("");
    setAnswer("");
    setFollowUps([]);
    setSources([]);

    try {
      const res = await fetch("/backend/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed, conversationId: threadId }),
      });

      // The session expired between page load and submit — sign in again.
      if (res.status === 401) {
        router.push("/login");
        return;
      }

      const body = await res.text();

      // On failure the backend returns JSON like { detail: "..." }.
      if (!res.ok) {
        setError(safeErrorMessage(body));
        return;
      }

      // Remember the thread so follow-ups continue it.
      setConversationId(res.headers.get("X-Conversation-Id"));

      // Split "answer half" and "sources half" on the delimiter.
      const [answerPart = "", sourcesPart = ""] = body.split(SOURCE_DELIMITER);

      // The answer half is JSON: { answer, followUps }.
      try {
        const parsed = JSON.parse(answerPart.trim());
        setAnswer(parsed.answer ?? "");
        setFollowUps(parsed.followUps ?? []);
      } catch {
        // If it isn't JSON, just show the raw text.
        setAnswer(answerPart.trim());
      }

      setSources(parseSources(sourcesPart));
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Typing a question in the box starts a fresh thread.
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runSearch(query, false);
  }

  // Clicking a follow-up continues the thread it came from.
  function handleFollowUp(question: string) {
    runSearch(question, true);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col p-6">
      {/* Top bar: shows who is signed in and a Sign out button.
          Only rendered once the Supabase session has resolved. */}
      {userLabel && (
        <div className="mb-2 flex items-center justify-end gap-3 text-sm">
          <span className="text-gray-500">{userLabel}</span>
          <button
            onClick={handleSignOut}
            className="rounded-lg border border-gray-200 px-3 py-1 text-gray-700 transition-colors hover:border-black hover:bg-gray-50"
          >
            Sign out
          </button>
        </div>
      )}

      <h1 className="text-center text-2xl font-bold">Perplexity AI</h1>
      <p className="mb-8 mt-1 text-center text-gray-500">Search anything</p>

      <div className="flex-1 space-y-6 overflow-y-auto">
        {/* Echo the question the results belong to, since the input box is
            cleared as soon as the search starts. */}
        {asked && (
          <h2 className="text-lg font-semibold text-gray-900">{asked}</h2>
        )}

        {loading && (
          <p className="animate-pulse text-sm text-gray-400">Searching…</p>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Answer */}
        {answer && (
          <Section title="Answer">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              {/* The answer is Markdown from the LLM, so render it as Markdown
                  instead of showing the raw `**`, `#`, list markers, etc. */}
              <Markdown>{answer}</Markdown>
            </div>
          </Section>
        )}

        {/* Follow-up questions */}
        {followUps.length > 0 && (
          <Section title="Follow-up questions">
            <div className="flex flex-col gap-2">
              {followUps.map((question, i) => (
                <button
                  key={i}
                  onClick={() => handleFollowUp(question)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:border-black hover:bg-gray-50"
                >
                  {question}
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* Sources */}
        {sources.length > 0 && (
          <Section title={`Sources (${sources.length})`}>
            {/* Two-column grid of compact cards. Each shows a number badge,
                the site favicon + domain, and the page title. */}
            <div className="grid gap-2 sm:grid-cols-2">
              {sources.map((source, i) => (
                <a
                  key={i}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex gap-3 rounded-lg border border-gray-200 p-3 transition-colors hover:border-black hover:bg-gray-50"
                >
                  {/* Numbered badge, so the answer can cite [1], [2], ... */}
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-500">
                    {i + 1}
                  </span>

                  <div className="min-w-0">
                    {/* Favicon + domain row */}
                    <div className="mb-1 flex items-center gap-1.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={faviconUrl(source.url)}
                        alt=""
                        className="h-3.5 w-3.5 rounded-sm"
                      />
                      <span className="truncate text-xs text-gray-400">
                        {domainOf(source.url)}
                      </span>
                    </div>

                    {/* Page title (falls back to the URL) */}
                    <p className="line-clamp-2 text-sm font-medium text-gray-800">
                      {source.title || source.url}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </Section>
        )}
      </div>

      {/* Search box */}
      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          type="text"
          placeholder="Ask a question..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-black"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-black px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {loading ? "…" : "Search"}
        </button>
      </form>
    </div>
  );
}

// Small titled block used for Answer / Follow-ups / Sources.
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

// Renders the LLM's Markdown answer as formatted HTML.
//
// Tailwind's CSS reset removes default styling from headings, lists, etc., so
// we hand each Markdown element the classes it needs to look right. Keeps the
// same small, black-on-light look as the rest of the app.
function Markdown({ children }: { children: string }) {
  return (
    <div className="text-sm leading-relaxed text-gray-800">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: (props) => <p className="mb-3 last:mb-0" {...props} />,
          h1: (props) => (
            <h1 className="mb-2 mt-4 text-lg font-bold first:mt-0" {...props} />
          ),
          h2: (props) => (
            <h2 className="mb-2 mt-4 text-base font-bold first:mt-0" {...props} />
          ),
          h3: (props) => (
            <h3 className="mb-2 mt-3 text-sm font-bold first:mt-0" {...props} />
          ),
          ul: (props) => (
            <ul className="mb-3 list-disc space-y-1 pl-5" {...props} />
          ),
          ol: (props) => (
            <ol className="mb-3 list-decimal space-y-1 pl-5" {...props} />
          ),
          li: (props) => <li className="leading-relaxed" {...props} />,
          a: (props) => (
            <a
              className="text-blue-600 underline hover:text-blue-800"
              target="_blank"
              rel="noreferrer"
              {...props}
            />
          ),
          strong: (props) => <strong className="font-semibold" {...props} />,
          code: (props) => (
            <code
              className="rounded bg-gray-200 px-1 py-0.5 font-mono text-xs"
              {...props}
            />
          ),
          pre: (props) => (
            <pre
              className="mb-3 overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100"
              {...props}
            />
          ),
          blockquote: (props) => (
            <blockquote
              className="mb-3 border-l-2 border-gray-300 pl-3 text-gray-600"
              {...props}
            />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

// Extract just the domain from a URL, e.g. "https://en.wikipedia.org/wiki/X"
// -> "en.wikipedia.org". Falls back to the raw string if it isn't a valid URL.
function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// A small favicon for a URL's domain, via Google's public favicon service.
function faviconUrl(url: string): string {
  return `https://www.google.com/s2/favicons?domain=${domainOf(url)}&sz=64`;
}

// Pull a readable message out of the backend's error response.
function safeErrorMessage(body: string): string {
  try {
    return JSON.parse(body).detail ?? "Something went wrong.";
  } catch {
    return body || "Something went wrong.";
  }
}
