"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getClientEnv } from "@/env";
import type { Database } from "./types";

let client: SupabaseClient<Database> | null = null;

export function getSupabaseBrowserClient() {
  if (!client) {
    const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = getClientEnv();
    client = createBrowserClient<Database>(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY);
    (client.auth as typeof client.auth & { suppressGetSessionWarning?: boolean }).suppressGetSessionWarning = true;
  }
  return client;
}
