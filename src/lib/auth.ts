/**
 * Authentication helpers shared across server components and server actions.
 * These utilities encapsulate the boilerplate involved in reading Supabase's
 * auth state and ensuring the companion `profiles` table stays in sync with the
 * authenticated user. By keeping the logic here we avoid duplicating session
 * fetching and profile hydration in every route.
 */

import type { Session } from "@supabase/supabase-js";
import { computeEffectivePlan } from "@/lib/plan";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service";
import type { Profile } from "@/lib/supabase/types";

/**
 * Retrieves the current Supabase session and verified user in parallel.
 *
 * - Returns the merged session (with the `user` patched in) when both the
 *   session cookie and Supabase auth API confirm an authenticated context.
 * - Returns `null` when no session exists so that callers can gracefully render
 *   marketing pages or redirect to sign-in.
 * - Throws when Supabase returns an unexpected error so upstream handlers can
 *   surface error boundaries.
 */
export async function getSession() {
  const supabase = await getSupabaseServerClient();
  const [sessionResult, userResult] = await Promise.all([
    supabase.auth.getSession(),
    supabase.auth.getUser(),
  ]);

  if (sessionResult.error) throw sessionResult.error;
  if (userResult.error) throw userResult.error;

  const session = sessionResult.data.session;
  const user = userResult.data.user ?? null;

  if (!session || !user) {
    return null;
  }

  return { ...session, user } as Session;
}

/**
 * Loads the profile row for the authenticated user if both the session and
 * profile exist.
 *
 * Consumers often need to display profile metadata (username, plan tier) but
 * can function when the profile is missing—so this helper explicitly returns
 * `null` rather than throwing. That behaviour keeps server components easy to
 * compose with optional profile UI.
 */
export async function getAuthenticatedProfile() {
  const supabase = await getSupabaseServerClient();
  const { data: userData, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!userData?.user) return null;

  await computeEffectivePlan(supabase, userData.user.id);

  const { data, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  return data as Profile | null;
}

/**
 * Ensures an authenticated request has an associated profile record.
 *
 * This helper is used in sensitive flows (e.g., server actions) where an
 * authenticated user is mandatory. It double checks for an existing profile and
 * provisions one via the service-role client when absent so downstream logic can
 * assume the profile exists.
 */
export async function requireUserProfile() {
  const supabase = await getSupabaseServerClient();
  const { data: userData, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!userData?.user) {
    throw new Error("Not authenticated");
  }

  await computeEffectivePlan(supabase, userData.user.id);

  const { data, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!data) {
    const profile = await ensureProfile(userData.user.id, userData.user.email ?? null);
    return profile;
  }

  return data as Profile;
}

/**
 * Creates a `profiles` row when one does not already exist.
 *
 * The username is derived from the email prefix (falling back to a user-based
 * slug) to give new accounts a sensible default for public collection URLs. The
 * function returns the freshly inserted profile so callers can immediately use
 * it in responses without an additional query.
 */
export async function ensureProfile(userId: string, email?: string | null) {
  const service = getSupabaseServiceRoleClient();

  const existing = await service.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (existing.data) return existing.data as Profile;

  const usernameBase = (email ?? userId)
    .split("@")[0]
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .toLowerCase();
  const username = usernameBase || `user-${userId.slice(0, 6)}`;

  const insertResult = await service
    .from("profiles")
    .insert({
      id: userId,
      username,
      display_name: usernameBase,
    })
    .select("*")
    .maybeSingle();

  if (insertResult.error) {
    if (insertResult.error.code === "23505") {
      const collisionLookup = await service.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (collisionLookup.data) {
        return collisionLookup.data as Profile;
      }
    }

    throw insertResult.error;
  }

  return insertResult.data as Profile;
}
