import type { Profile } from "@/lib/supabase/types";

export const PLAN_COLLECTION_LIMIT: Record<Profile["plan"], number | null> = {
  free: 5,
  plus: null,
  pro: null,
};

export function canCreateCollection(profile: Profile, currentCount: number) {
  const limit = PLAN_COLLECTION_LIMIT[profile.plan];
  if (limit === null) return true;
  return currentCount < limit;
}

export function planGateMessage(profile: Profile) {
  const limit = PLAN_COLLECTION_LIMIT[profile.plan];
  if (limit === null) return "";
  return `Free members can create up to ${limit} collections.`;
}
