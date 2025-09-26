"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ApiError } from "@/lib/api";
import { slugify } from "@/lib/slugs";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface UpdateProfileInput {
  username: string;
  displayName?: string;
}

export async function updateProfileAction(input: UpdateProfileInput) {
  const cookieStore = await cookies();
  const supabase = await createSupabaseServerClient(cookieStore);
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) throw userError;

  const user = userData?.user;
  if (!user) {
    throw new ApiError("not_authenticated", "Please sign in", 401);
  }

  const username = slugify(input.username);
  if (!username) {
    throw new ApiError("validation_error", "Username cannot be empty", 400);
  }

  const usernameLower = username.toLowerCase();
  const { data: conflicts, error: conflictError } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", usernameLower)
    .neq("id", user.id);

  if (conflictError) throw conflictError;
  if (conflicts && conflicts.length > 0) {
    throw new ApiError("username_taken", "That username is already in use", 409);
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      username,
      display_name: input.displayName?.trim() || null,
    })
    .eq("id", user.id);

  if (error) throw error;

  revalidatePath("/settings/profile");
  revalidatePath("/app");
  revalidatePath(`/c/${username}`);
  return { ok: true } as const;
}
