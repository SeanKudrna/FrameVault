/**
 * Layout used for all authenticated routes under `/app`. It performs a
 * server-side auth check and guarantees that a profile record exists before
 * rendering the shared `AppShell` navigation.
 */

import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ensureProfile } from "@/lib/auth";
import { computeEffectivePlan } from "@/lib/plan";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

/**
 * Authenticated layout that ensures a user profile exists before rendering the app shell.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServerClient();
  const [{ data: userData, error: userError }] = await Promise.all([
    supabase.auth.getUser(),
  ]);

  if (userError) {
    console.error("Supabase auth error", userError);
  }

  const user = userData?.user;
  if (!user) {
    redirect("/auth/sign-in");
  }

  await computeEffectivePlan(supabase, user.id);

  const { data, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error(profileError);
    redirect("/auth/sign-in");
  }

  const profile = data ? (data as Profile) : await ensureProfile(user.id, user.email ?? null);

  return <AppShell profile={profile}>{children}</AppShell>;
}
