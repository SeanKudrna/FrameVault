/**
 * Service-role Supabase client factory. This elevated client is required for
 * tasks that need bypassed RLS policies such as caching TMDB movies or creating
 * profile records on behalf of a user.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/env";
import type { Database } from "./types";

/**
 * Cached service-role Supabase client used for privileged operations such as
 * background caching.
 */
let serviceClient: SupabaseClient<Database> | null = null;

/**
 * Returns the shared service-role client, creating it on first use with
 * non-persistent auth. Tokens are intentionally non-refreshing because the
 * service key never expires and we do not want ambient background refresh jobs.
 */
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
