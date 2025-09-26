/**
 * Plan gating helpers centralised in one module. Keeping the mapping between
 * subscription tiers and collection limits here allows server actions and UI
 * components to share the same source of truth when determining whether a user
 * can create additional collections or requires an upgrade prompt.
 */

import type { Profile } from "@/lib/supabase/types";

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
  return `Free members can create up to ${limit} collections.`;
}
