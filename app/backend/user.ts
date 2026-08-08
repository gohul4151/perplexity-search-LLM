import type { User as SupabaseUser } from "@supabase/supabase-js";
import { prisma } from "./db";
import type { UserModel } from "../generated/prisma/models";

/**
 * Mirrors a Supabase-authenticated user into our own `User` table.
 *
 * Supabase owns authentication (passwords, OAuth tokens, sessions) in its
 * `auth.users` table, which we don't control and can't add foreign keys to.
 * So we keep a matching row in our `public.User` table for `Conversation` to
 * reference, linked back by `supabaseId`.
 *
 * Called from two places, because either can be the first to see a user:
 *   - `/auth/callback` right after sign-in (the normal path)
 *   - `/backend/conversation` as a safety net, so a search never fails just
 *     because the callback couldn't reach the database that one time.
 */
export async function syncUser(user: SupabaseUser): Promise<UserModel> {
  if (!user.email) {
    throw new Error("Supabase user has no email address");
  }

  // Human-readable name comes from the OAuth provider's metadata.
  const name: string =
    user.user_metadata?.name ?? user.user_metadata?.full_name ?? "User";

  // Which provider signed them in (must match our AuthProvider enum).
  const provider =
    user.app_metadata?.provider === "google" ? "Google" : "Github";

  // Matched on `email` (unique) rather than `supabaseId`, so signing in with a
  // different provider on the same address updates the existing row instead of
  // creating a duplicate person.
  return prisma.user.upsert({
    where: { email: user.email },
    update: { name, provider, supabaseId: user.id },
    create: { email: user.email, name, provider, supabaseId: user.id },
  });
}
