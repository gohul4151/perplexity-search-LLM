"use client";

import { useState } from "react";

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
  const [query, setQuery] = useState(""); // text in the input box
  const [answer, setAnswer] = useState(""); // the LLM answer
  const [followUps, setFollowUps] = useState<string[]>([]); // suggested questions
  const [sources, setSources] = useState<Source[]>([]); // web sources
  const [loading, setLoading] = useState(false); // waiting for the backend?
  const [error, setError] = useState(""); // error message, if any

  // Send a question to the backend and store the parsed response.
  async function runSearch(question: string) {
    const trimmed = question.trim();
    if (!trimmed) return;

    // Reset UI before the new search.
    setLoading(true);
    setError("");
    setAnswer("");
    setFollowUps([]);
    setSources([]);

    try {
      const res = await fetch("/backend/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });

      const body = await res.text();

      // On failure the backend returns JSON like { detail: "..." }.
      if (!res.ok) {
        setError(safeErrorMessage(body));
        return;
      }

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

  // Search when the form is submitted.
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runSearch(query);
  }

  // Clicking a follow-up question runs it as a new search.
  function handleFollowUp(question: string) {
    setQuery(question);
    runSearch(question);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col p-6">
      <h1 className="text-center text-2xl font-bold">Perplexity AI</h1>
      <p className="mb-8 mt-1 text-center text-gray-500">Search anything</p>

      <div className="flex-1 space-y-6 overflow-y-auto">
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
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {answer}
              </p>
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
          <Section title="Sources">
            <div className="space-y-2">
              {sources.map((source, i) => (
                <a
                  key={i}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-lg border border-gray-200 p-3 transition-colors hover:border-black"
                >
                  <p className="truncate text-sm font-medium text-gray-800">
                    {source.title || source.url}
                  </p>
                  {source.content && (
                    <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                      {source.content}
                    </p>
                  )}
                  <p className="mt-1 truncate text-xs text-gray-400">
                    {source.url}
                  </p>
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

// Pull a readable message out of the backend's error response.
function safeErrorMessage(body: string): string {
  try {
    return JSON.parse(body).detail ?? "Something went wrong.";
  } catch {
    return body || "Something went wrong.";
  }
}
