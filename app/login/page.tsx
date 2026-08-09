"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Sign-in page for the Perplexity AI clone (Supabase Auth).
 *
 * Clean white background + black accents to match the rest of the app.
 * Clicking a provider button hands off to Supabase, which redirects to the
 * provider and then back to `/auth/callback`.
 *
 * `useSearchParams()` must run inside a <Suspense> boundary, so the real UI
 * lives in <LoginInner> and this wrapper provides that boundary.
 */
export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}

// Turn our `?error=` codes into a readable sentence for the banner.
function errorMessage(code: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case "OAuthCallback":
      return "Sign-in could not be completed. Please try again.";
    default:
      return "Something went wrong during sign-in. Please try again.";
  }
}

function LoginInner() {
  // Tracks which button was clicked so we can show a spinner on it.
  const [signingIn, setSigningIn] = useState<string | null>(null);
  const error = errorMessage(useSearchParams().get("error"));

  // Kick off the OAuth flow with Supabase for the chosen provider.
  async function handleSignIn(provider: "google" | "github") {
    setSigningIn(provider);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        // Supabase sends the user back here after the provider approves.
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    // If the redirect couldn't even start, re-enable the buttons.
    if (error) setSigningIn(null);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Title */}
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-gray-200">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6 text-black"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-black">
            Welcome to Perplexity AI
          </h1>
          <p className="mt-1.5 text-sm text-gray-400">
            Sign in to start searching
          </p>
        </div>

        {/* Error banner — only shown when we were redirected back with an error. */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* OAuth Buttons */}
        <div className="flex flex-col gap-3">
          {/* Google */}
          <button
            id="sign-in-google"
            onClick={() => handleSignIn("google")}
            disabled={signingIn !== null}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:border-black hover:bg-gray-50 disabled:opacity-40"
          >
            {signingIn === "google" ? (
              <Spinner />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            Continue with Google
          </button>

          {/* GitHub */}
          <button
            id="sign-in-github"
            onClick={() => handleSignIn("github")}
            disabled={signingIn !== null}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-200 bg-black px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-900 disabled:opacity-40"
          >
            {signingIn === "github" ? (
              <Spinner light />
            ) : (
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.338c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"
                />
              </svg>
            )}
            Continue with GitHub
          </button>
        </div>


      </div>
    </div>
  );
}

/** Tiny spinner shown while the OAuth redirect is in progress. */
function Spinner({ light = false }: { light?: boolean }) {
  return (
    <svg
      className={`h-5 w-5 animate-spin ${light ? "text-white" : "text-gray-400"}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
