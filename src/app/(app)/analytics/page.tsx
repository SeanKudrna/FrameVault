import { redirect } from "next/navigation";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { getAnalyticsOverview } from "@/lib/analytics";
import { computeEffectivePlan } from "@/lib/plan";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

export default async function AnalyticsPage() {
  const supabase = await getSupabaseServerClient();
  const [{ data: userData, error: userError }] = await Promise.all([
    supabase.auth.getUser(),
  ]);

  if (userError) {
    throw userError;
  }

  const user = userData?.user;
  if (!user) {
    redirect("/auth/sign-in");
  }

  await computeEffectivePlan(supabase, user.id);

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profileData) {
    redirect("/settings/profile");
  }

  const profile = profileData as Profile;
  if (profile.plan !== "pro") {
    redirect("/settings/billing?plan=pro");
  }

  const overview = await getAnalyticsOverview(profile.id);

  return <AnalyticsDashboard profile={profile} overview={overview} />;
}
