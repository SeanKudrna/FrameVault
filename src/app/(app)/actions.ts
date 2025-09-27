"use server";

/**
 * Authenticated server actions shared across the app shell.
 */

import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function getAuthUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const user = data?.user;
  if (!user) {
    throw new ApiError("not_authenticated", "Sign in to continue", 401);
  }
  return { supabase, user };
}

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

/**
 * Follows another member by profile id.
 */
export async function followUserAction(targetProfileId: string) {
  if (!targetProfileId) {
    throw new ApiError("validation_error", "A profile id is required", 400);
  }

  const { supabase, user } = await getAuthUser();

  if (user.id === targetProfileId) {
    throw new ApiError("validation_error", "You can’t follow yourself", 400);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("id", targetProfileId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) {
    throw new ApiError("not_found", "Profile not found", 404);
  }

  const { error: insertError } = await supabase
    .from("follows")
    .upsert(
      { follower_id: user.id, followee_id: targetProfileId },
      { onConflict: "follower_id,followee_id", ignoreDuplicates: true }
    );
  if (insertError) throw insertError;

  revalidatePath("/discover");
  revalidatePath(`/c/${profile.username}`);

  return { ok: true } as const;
}

/**
 * Unfollows a member by profile id.
 */
export async function unfollowUserAction(targetProfileId: string) {
  if (!targetProfileId) {
    throw new ApiError("validation_error", "A profile id is required", 400);
  }

  const { supabase, user } = await getAuthUser();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", targetProfileId)
    .maybeSingle();

  if (profileError) throw profileError;

  if (user.id === targetProfileId) {
    throw new ApiError("validation_error", "You can’t unfollow yourself", 400);
  }

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("followee_id", targetProfileId);
  if (error) throw error;

  revalidatePath("/discover");
  if (profile?.username) {
    revalidatePath(`/c/${profile.username}`);
  }

  return { ok: true } as const;
}
