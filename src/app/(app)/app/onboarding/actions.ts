"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ApiError } from "@/lib/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OnboardingState } from "@/lib/supabase/types";
import { createCollectionAction } from "@/app/(app)/collections/actions";

interface UpdateOnboardingInput {
  claimedProfile?: boolean;
  createdFirstCollection?: boolean;
  addedFiveMovies?: boolean;
  completed?: boolean;
}

export async function updateOnboardingStateAction(partial: UpdateOnboardingInput) {
  const cookieStore = await cookies();
  const supabase = await createSupabaseServerClient(cookieStore);
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) throw userError;
  const user = userData?.user;
  if (!user) {
    throw new ApiError("not_authenticated", "Sign in required", 401);
  }

  const profileResponse = await supabase
    .from("profiles")
    .select("onboarding_state")
    .eq("id", user.id)
    .maybeSingle();

  if (profileResponse.error) throw profileResponse.error;

  const current = (profileResponse.data?.onboarding_state as OnboardingState | null) ?? {
    claimedProfile: false,
    createdFirstCollection: false,
    addedFiveMovies: false,
    completed: false,
  };

  const next: OnboardingState = {
    claimedProfile: partial.claimedProfile ?? current.claimedProfile,
    createdFirstCollection: partial.createdFirstCollection ?? current.createdFirstCollection,
    addedFiveMovies: partial.addedFiveMovies ?? current.addedFiveMovies,
    completed: false,
  };

  if (partial.completed || (next.claimedProfile && next.createdFirstCollection && next.addedFiveMovies)) {
    next.completed = true;
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ onboarding_state: next })
    .eq("id", user.id);

  if (updateError) throw updateError;

  revalidatePath("/app");
  revalidatePath("/app/onboarding");
  return next;
}

export async function createStarterCollectionAction() {
  const collection = await createCollectionAction({
    title: "Rainy Day Films",
    description: "A cozy starting shelf with space for rainy-day favourites.",
    isPublic: false,
  });
  const onboardingState = await updateOnboardingStateAction({ createdFirstCollection: true });
  return { collection, onboardingState };
}
