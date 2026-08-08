import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncUser } from "@/app/backend/user";

/**
 * GET /auth/callback
 *
 * Supabase redirects here after the user approves the OAuth provider (GitHub /
 * Google). It arrives with a `?code=...` which we swap for a real session
 * (stored in cookies). We then mirror the user into our own Postgres `User`
 * table and send them to the home / chat page.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Where to land after login; defaults to the home (chat) page.
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();

    // Turn the one-time `code` into a persisted session.
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Mirror the Supabase user into our app's own database so conversations
      // can reference them. Supabase already handled authentication.
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.email) {
        try {
          await syncUser(user);
        } catch (err) {
          // A DB problem must NOT block a successful login — log and move on.
          // The user still gets a valid Supabase session, and the conversation
          // route re-runs `syncUser` on their first search, so persistence
          // catches up as soon as the database is reachable again.
          console.error("Could not persist user during sign-in:", err);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // No code, or the exchange failed -> back to login with an error flag.
  return NextResponse.redirect(`${origin}/login?error=OAuthCallback`);
}
