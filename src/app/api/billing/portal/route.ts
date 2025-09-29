/**
 * Generates Stripe Customer Portal sessions so members can manage billing.
 */

import { cookies } from "next/headers";
import { apiError, apiJson } from "@/lib/api";
import { getServerEnv } from "@/env";
import { getStripeClient } from "@/lib/stripe";
import { computeEffectivePlan } from "@/lib/plan";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

export async function GET() {
  try {
    const env = getServerEnv();
    const { STRIPE_SECRET_KEY } = env;
    if (!STRIPE_SECRET_KEY) {
      return apiError("billing_disabled", "Stripe keys are not configured", 503);
    }

    const cookieStore = await cookies();
    const supabase = await createSupabaseServerClient(cookieStore);
    const { data: userData, error: userError } = await supabase.auth.getUser().catch((error) => {
      // Handle auth session missing errors gracefully
      if (error?.message?.includes('Auth session missing')) {
        return { data: { user: null }, error: null };
      }
      throw error;
    });
    if (userError) throw userError;
    const user = userData?.user;
    if (!user) {
      return apiError("not_authenticated", "Sign in to manage billing", 401);
    }

    await computeEffectivePlan(supabase, user.id);

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profileData) {
      return apiError("profile_missing", "Complete your profile before managing billing", 400);
    }

    const profile = profileData as Profile;
    if (!profile.stripe_customer_id) {
      return apiError("no_subscription", "Upgrade to Plus or Pro to access billing", 400);
    }

    const stripe = getStripeClient();
    const portal = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/settings/billing`,
    });

    return apiJson({ url: portal.url });
  } catch (error) {
    console.error("/api/billing/portal error", error);
    return apiError("internal_error", "Unable to create billing portal session", 500);
  }
}
