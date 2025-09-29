import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { updateOnboardingStateAction } from "@/app/(app)/app/onboarding/actions";
import { computeEffectivePlan } from "@/lib/plan";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { OnboardingState, Profile } from "@/lib/supabase/types";

export default async function OnboardingPage() {
  const supabase = await getSupabaseServerClient();
  const [{ data: userData, error: userError }] = await Promise.all([
    supabase.auth.getUser().catch((error) => {
      // Handle auth session missing errors gracefully
      if (error?.message?.includes('Auth session missing')) {
        return { data: { user: null }, error: null };
      }
      throw error;
    }),
  ]);

  if (userError) {
    throw userError;
  }

  const user = userData?.user;
  if (!user) {
    redirect("/auth/sign-in");
  }

  await computeEffectivePlan(supabase, user.id);

  const profileResponse = await supabase
    .from("profiles")
    .select("id, username, display_name, preferred_region, plan, onboarding_state")
    .eq("id", user.id)
    .maybeSingle();

  if (profileResponse.error) throw profileResponse.error;
  if (!profileResponse.data) {
    redirect("/settings/profile");
  }

  const profile = profileResponse.data as Profile;
  let onboardingState = (profile.onboarding_state as OnboardingState | null) ?? {
    claimedProfile: false,
    createdFirstCollection: false,
    addedFiveMovies: false,
    completed: false,
  };

  if (onboardingState.completed) {
    redirect("/app");
  }

  const collectionsResponse = await supabase
    .from("collections")
    .select("id, title, created_at, collection_items(count)")
    .eq("owner_id", profile.id)
    .order("created_at", { ascending: true });

  if (collectionsResponse.error) throw collectionsResponse.error;

  const collections = (collectionsResponse.data ?? []).map((collection) => {
    const count = Array.isArray(collection.collection_items)
      ? (collection.collection_items[0]?.count as number | undefined) ?? 0
      : 0;
    return {
      id: collection.id as string,
      title: collection.title as string,
      created_at: collection.created_at as string,
      item_count: count,
    };
  });

  const totalItems = collections.reduce((sum, collection) => sum + collection.item_count, 0);

  if (!onboardingState.addedFiveMovies && totalItems >= 5) {
    onboardingState = await updateOnboardingStateAction({ addedFiveMovies: true });
  }

  if (onboardingState.completed) {
    redirect("/app");
  }

  return (
    <OnboardingFlow
      profile={{
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name,
        preferred_region: profile.preferred_region,
      }}
      initialState={onboardingState}
      totalItems={totalItems}
      initialCollections={collections.map((collection) => ({
        id: collection.id,
        title: collection.title,
        createdAt: collection.created_at,
        itemCount: collection.item_count,
      }))}
    />
  );
}
