/**
 * Authenticated billing settings page. Loads subscription state on the server
 * so the client component can focus on interactions with Stripe.
 */

import { redirect } from "next/navigation";
import { BillingSettings } from "@/components/billing/billing-settings";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Plan, Profile } from "@/lib/supabase/types";

interface PageProps {
  searchParams:
    | Promise<{ checkoutSuccess?: string; checkoutCanceled?: string }>
    | { checkoutSuccess?: string; checkoutCanceled?: string };
}

export default async function BillingSettingsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await getSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) throw userError;
  const user = userData?.user;
  if (!user) {
    redirect("/auth/sign-in");
  }

  const [{ data: profileData, error: profileError }, { data: subscriptionData, error: subscriptionError }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase
        .from("subscriptions")
        .select("plan, status, current_period_end")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  if (profileError) throw profileError;
  if (subscriptionError) throw subscriptionError;
  if (!profileData) {
    redirect("/settings/profile?onboarding=1");
  }

  const checkoutStatus = params?.checkoutSuccess
    ? "success"
    : params?.checkoutCanceled
      ? "canceled"
      : undefined;

  const subscriptionSnapshot = subscriptionData
    ? {
        plan: (subscriptionData.plan as Plan) ?? "free",
        status: subscriptionData.status,
        current_period_end: subscriptionData.current_period_end,
      }
    : null;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Billing</h1>
        <p className="text-sm text-slate-400">Manage your subscription, invoices, and plan upgrades.</p>
      </header>
      <BillingSettings
        profile={profileData as Profile}
        subscription={subscriptionSnapshot}
        checkoutStatus={checkoutStatus}
      />
    </div>
  );
}
