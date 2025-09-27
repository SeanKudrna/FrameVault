/**
 * Creates Stripe Checkout sessions for upgrading to Plus or Pro.
 */

import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { apiError, apiJson } from "@/lib/api";
import { getServerEnv } from "@/env";
import { getPriceIdForPlan, type PaidPlan } from "@/lib/billing";
import { getStripeClient } from "@/lib/stripe";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

interface CheckoutPayload {
  plan: PaidPlan;
}

function parseBody(value: unknown): CheckoutPayload | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as { plan?: string };
  if (payload.plan !== "plus" && payload.plan !== "pro") {
    return null;
  }
  return { plan: payload.plan };
}

export async function POST(request: NextRequest) {
  try {
    const env = getServerEnv();
    const { STRIPE_SECRET_KEY } = env;
    if (!STRIPE_SECRET_KEY) {
      return apiError("billing_disabled", "Stripe keys are not configured", 503);
    }

    const body = await request.json().catch(() => null);
    const payload = parseBody(body);
    if (!payload) {
      return apiError("invalid_request", "Specify a plan of 'plus' or 'pro'", 400);
    }

    const cookieStore = await cookies();
    const supabase = await createSupabaseServerClient(cookieStore);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    const user = userData?.user;
    if (!user) {
      return apiError("not_authenticated", "Sign in to upgrade", 401);
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profileData) {
      return apiError("profile_missing", "Complete your profile before upgrading", 400);
    }

    const profile = profileData as Profile;

    const stripe = getStripeClient();
    const priceId = getPriceIdForPlan(payload.plan);
    const siteUrl = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

    let stripeCustomerId = profile.stripe_customer_id as string | null;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      stripeCustomerId = customer.id;
      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", user.id);
      if (profileUpdateError) throw profileUpdateError;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      billing_address_collection: "auto",
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${siteUrl}/settings/billing?checkoutSuccess=1`,
      cancel_url: `${siteUrl}/settings/billing?checkoutCanceled=1`,
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan: payload.plan,
        },
      },
      metadata: {
        supabase_user_id: user.id,
        plan: payload.plan,
      },
    });

    if (!session.url) {
      return apiError("session_creation_failed", "Stripe session did not include a redirect URL", 500);
    }

    return apiJson({ url: session.url });
  } catch (error) {
    console.error("/api/billing/checkout error", error);
    return apiError("internal_error", "Unable to create checkout session", 500);
  }
}
