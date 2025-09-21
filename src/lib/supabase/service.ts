import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/env";
import type { Database } from "./types";

let serviceClient: SupabaseClient<Database> | null = null;

export function getSupabaseServiceRoleClient() {
  if (!serviceClient) {
    const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
    serviceClient = createClient<Database>(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return serviceClient;
}
