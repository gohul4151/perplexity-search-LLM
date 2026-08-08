import { type NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

/**
 * Root proxy — runs before every matched request and delegates to the
 * Supabase session helper, which refreshes the session and enforces sign-in.
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on all paths EXCEPT:
     * - _next/static / _next/image (Next.js internals)
     * - favicon.ico and image asset files
     * These don't need auth and shouldn't pay the session-check cost.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
