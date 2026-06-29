/**
 * Supabase JS client factories — cookie-aware for Next.js App Router.
 *
 * Two factories:
 *   - browserClient():  use in 'use client' components. Reads/writes session
 *                       cookies via document.cookie.
 *   - serverClient():   use in server components / route handlers / server
 *                       actions. Reads cookies via next/headers, writes back
 *                       via the response cookie API. Uses the user's JWT (if
 *                       logged in) for RLS scoping.
 *
 * For anonymous flows that need privileged writes (parent course-selection,
 * landing-page counts), call the SECURITY DEFINER RPC functions defined in
 * schema/007 — NOT service-role from the app. Service-role is reserved for
 * offline ETL scripts that run from a trusted terminal.
 *
 * Env vars come from .env.local in dev, and from Vercel environment variables
 * in production.
 */

import { createBrowserClient, createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types/supabase";

const URL = process.env.SUPABASE_URL!;
const ANON = process.env.SUPABASE_ANON_KEY!;

if (typeof window !== "undefined") {
  if (!URL || !ANON) {
    // eslint-disable-next-line no-console
    console.warn(
      "[manhaj/supabase] SUPABASE_URL or SUPABASE_ANON_KEY missing. " +
      "Add them to .env.local in your app — see .env.example.",
    );
  }
}

/** Browser-side client. Use in client components. RLS-enforced via user JWT. */
export function browserClient() {
  return createBrowserClient<Database>(URL, ANON);
}

/**
 * Server-side client. Use in server components, server actions, route handlers.
 *
 * Reads the user's session cookie (set by magic-link callback) and passes the
 * user's JWT to Supabase, so RLS policies apply per-user automatically.
 *
 * For anonymous flows (landing-page counts, parent course-selection submit),
 * call the SECURITY DEFINER RPC functions defined in schema/007 — they
 * validate input and perform the writes internally.
 *
 * The legacy { serviceRole: true } opt-in is REMOVED from runtime. Service
 * role still exists for offline ETL scripts (etl/load_to_postgres.py +
 * etl/upload_source_to_supabase.py) which run from a trusted terminal, not
 * the deployed app.
 */
export async function serverClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(URL, ANON, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: CookieOptions }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // The `set` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
  });
}
