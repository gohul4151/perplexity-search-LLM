import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for use on the SERVER (Server Components, Route Handlers).
 *
 * It bridges Supabase's auth session into Next.js cookies. `cookies()` is
 * async in Next 16, so this factory is async too — always `await createClient()`.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        // Give Supabase the request's cookies so it can read the session.
        getAll() {
          return cookieStore.getAll();
        },
        // Let Supabase refresh/rotate the session cookies.
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `setAll` was called from a Server Component, which cannot write
            // cookies. That's fine — the middleware refreshes the session, so
            // this can be safely ignored.
          }
        },
      },
    },
  );
}
