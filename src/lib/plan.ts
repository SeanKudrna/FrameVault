/**
 * Plan gating helpers centralised in one module. Keeping the mapping between
 * subscription tiers and collection limits here allows server actions and UI
 * components to share the same source of truth when determining whether a user
 * can create additional collections or requires an upgrade prompt.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Plan, Profile } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

const FALLBACK_PLAN: Plan = "free";

function coercePlan(value: unknown): Plan {
  if (value === "plus" || value === "pro") {
    return value;
  }
  return FALLBACK_PLAN;
}

/**
 * Lookup table describing how many collections each plan tier is allowed to
 * create. A value of `null` represents unlimited collections for the tier.
 */
export const PLAN_COLLECTION_LIMIT: Record<Profile["plan"], number | null> = {
  free: 5,
  plus: null,
  pro: null,
};

/**
 * Returns whether the provided profile can create another collection based on
 * their plan limit. This helper is intentionally tiny so it can be imported into
 * both server actions (authoritative checks) and client components (UI gating)
 * without pulling in heavy dependencies.
 */
export function canCreateCollection(profile: Profile, currentCount: number) {
  const limit = PLAN_COLLECTION_LIMIT[profile.plan];
  if (limit === null) return true;
  return currentCount < limit;
}

/**
 * Produces a human-readable message for plan gating banners when a user reaches
 * their limit. Keeping message construction here means marketing copy is
 * consistent across dashboard banners and toast notifications.
 */
export function planGateMessage(profile: Profile) {
  const limit = PLAN_COLLECTION_LIMIT[profile.plan];
  if (limit === null) return "";
  return `Free members can create up to ${limit} collections. Upgrade to Plus for unlimited shelves.`;
}

/**
 * Applies any pending plan changes for the supplied user and returns the
 * effective tier. Useful for server actions that already know the user id.
 */
export async function computeEffectivePlan(client: Client, userId: string): Promise<Plan> {
  const { data, error } = await client.rpc("compute_effective_plan", { target_user: userId });
  if (error) throw error;
  if (data === null || typeof data !== "string") {
    return FALLBACK_PLAN;
  }
  return coercePlan(data);
}

/**
 * Resolves the effective plan for the authenticated context derived from the
 * supplied Supabase client.
 */
export async function computeEffectivePlanSelf(client: Client): Promise<Plan> {
  const { data, error } = await client.rpc("compute_effective_plan_self");
  if (error) throw error;
  if (data === null || typeof data !== "string") {
    return FALLBACK_PLAN;
  }
  return coercePlan(data);
}
