/**
 * Server component powering the profile settings page. Auth checks happen here
 * so the client form can stay focused on presentation.
 */

import { redirect } from "next/navigation";
import { ProfileSettingsForm } from "@/components/profile/profile-settings-form";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

export default async function ProfileSettingsPage() {
  const supabase = await getSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) throw userError;

  const user = userData?.user;
  if (!user) {
    redirect("/auth/sign-in");
  }

  const { data: profileData, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!profileData) {
    redirect("/settings/profile?onboarding=1");
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Profile</h1>
        <p className="text-sm text-slate-400">Control your public handle and display identity.</p>
      </header>
      <div className="rounded-3xl border border-slate-800/70 bg-slate-950/70 p-8 shadow-[0_20px_70px_-60px_rgba(15,23,42,0.9)]">
        <ProfileSettingsForm profile={profileData as Profile} />
      </div>
    </div>
  );
}
