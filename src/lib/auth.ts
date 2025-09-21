import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service";
import type { Profile } from "@/lib/supabase/types";

export async function getSession() {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session ?? null;
}

export async function getAuthenticatedProfile() {
  const supabase = await getSupabaseServerClient();
  const { data: userData, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!userData?.user) return null;

  const { data, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  return data as Profile | null;
}

export async function requireUserProfile() {
  const supabase = await getSupabaseServerClient();
  const { data: userData, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!userData?.user) {
    throw new Error("Not authenticated");
  }

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

  const { data, error } = await service
    .from("profiles")
    .insert({
      id: userId,
      username,
      display_name: usernameBase,
    })
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data as Profile;
}
