"use client";

/**
 * Browser-side Supabase client factory. Client components use this module to
 * interact with Supabase without duplicating environment plumbing or worrying
 * about repeated client instantiation.
 */

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getClientEnv } from "@/env";
import type { Database } from "./types";

/**
 * Cached singleton instance of the browser Supabase client. Ensures we only
 * create one per session and reuse it across renders.
 */
let client: SupabaseClient<Database> | null = null;

/**
 * Lazily instantiates and returns the browser Supabase client configured with
 * public credentials. The `suppressGetSessionWarning` flag is set because we
 * always revalidate sessions with `auth.getUser()` on the server, making the
 * SSR warning redundant for this architecture.
 */
export function getSupabaseBrowserClient() {
  if (!client) {
    const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = getClientEnv();
    client = createBrowserClient<Database>(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY);
    (client.auth as typeof client.auth & { suppressGetSessionWarning?: boolean }).suppressGetSessionWarning = true;
  }
  return client;
}

/**
 * Resets the cached Supabase browser client instance. This is used during sign out
 * to ensure a completely fresh client instance is created on next access.
 */
export function resetSupabaseBrowserClient() {
  client = null;
}
