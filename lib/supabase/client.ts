import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for use in the BROWSER (Client Components, event handlers).
 *
 * It reads the public URL + publishable key (safe to expose to the browser)
 * and manages the auth session in cookies so the server can read it too.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
