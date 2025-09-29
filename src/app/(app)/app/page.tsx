/**
 * Authenticated dashboard route showing the user's collections and create
 * controls. All reads happen on the server so the dashboard can stream data
 * immediately after authentication.
 */

import { redirect } from "next/navigation";
import { CollectionsDashboard } from "@/components/collections/collections-dashboard";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile, OnboardingState } from "@/lib/supabase/types";
import { getSmartPicksForUser } from "@/lib/recommendations";
export default async function DashboardPage() {
  const supabase = await getSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser().catch((error) => {
    // Handle auth session missing errors gracefully
    if (error?.message?.includes('Auth session missing')) {
      return { data: { user: null }, error: null };
    }
    throw error;
  });

  if (userError) {
    throw userError;
  }

  const user = userData?.user;
  if (!user) {
    redirect("/auth/sign-in");
  }

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profileData) {
    redirect("/settings/profile");
  }

  const { data: collectionsData, error: collectionsError } = await supabase
    .from("collections")
    .select("id, title, slug, description, is_public, created_at, updated_at, theme, collection_items(count)")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });

  if (collectionsError) {
    throw collectionsError;
  }

  const onboardingState = (profileData.onboarding_state as OnboardingState | null) ?? null;
  if (!onboardingState?.completed) {
    redirect("/app/onboarding");
  }

  // Flatten the nested count aggregate to the shape expected by the dashboard
  // component. We expose `item_count` rather than the raw relationship to keep
  // the UI decoupled from Supabase response formats.
  const collections = (collectionsData ?? []).map((collection) => ({
    id: collection.id,
    title: collection.title,
    slug: collection.slug,
    description: collection.description,
    is_public: collection.is_public,
    created_at: collection.created_at,
    updated_at: collection.updated_at,
    theme: collection.theme,
    item_count: Array.isArray(collection.collection_items)
      ? (collection.collection_items[0]?.count as number | undefined) ?? 0
      : 0,
  }));

  let recommendations: Awaited<ReturnType<typeof getSmartPicksForUser>> | null = null;
  if ((profileData as Profile).plan === "pro") {
    try {
      recommendations = await getSmartPicksForUser(profileData.id, { limit: 6 });
    } catch (error) {
      console.error("Failed to load recommendations", error);
    }
  }

  return (
    <CollectionsDashboard
      profile={profileData}
      collections={collections}
      recommendations={recommendations?.picks ?? null}
      tasteProfile={recommendations?.profile ?? null}
    />
  );
}
