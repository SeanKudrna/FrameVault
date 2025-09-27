"use server";

/**
 * Authenticated server actions shared across the app shell.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Signs the current user out by clearing Supabase auth cookies. Used by the
 * app shell to ensure client + server session state stay in sync.
 */
export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) {
    throw error;
  }
}
