/**
 * Shared billing helpers including plan/price mapping and subscription status
 * utilities. Keeping this logic here prevents API routes and components from
 * duplicating Stripe-specific knowledge.
 */

import type Stripe from "stripe";
import type { Plan } from "@/lib/supabase/types";

/**
 * Price identifiers provisioned in the Stripe dashboard.
 */
export const STRIPE_PRICE_IDS = {
  plus: "price_1SBlKvBPPMheh1aapswc1eHs",
  pro: "price_1SBlLXBPPMheh1aai1NiKNDA",
} as const satisfies Record<Exclude<Plan, "free">, string>;

export type PaidPlan = Exclude<Plan, "free">;

/**
 * Resolves the Stripe price identifier for a paid plan.
 */
export function getPriceIdForPlan(plan: PaidPlan) {
  return STRIPE_PRICE_IDS[plan];
}

/**
 * Maps a Stripe price identifier back to a FrameVault plan when processing
 * subscription events.
 */
export function getPlanFromPrice(priceId: string | null | undefined): PaidPlan | null {
  if (!priceId) return null;
  const entry = Object.entries(STRIPE_PRICE_IDS).find(([, value]) => value === priceId);
  if (!entry) return null;
  return entry[0] as PaidPlan;
}

const ACTIVE_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status | "trialing">([
  "active",
  "trialing",
  "past_due",
]);

/**
 * Returns whether a Stripe subscription status should be considered active for
 * gating purposes. `past_due` remains active to avoid prematurely locking
 * members out while Stripe handles retries.
 */
export function isActiveStripeStatus(status: string | null | undefined) {
  if (!status) return false;
  return ACTIVE_SUBSCRIPTION_STATUSES.has(status as Stripe.Subscription.Status);
}

/**
 * Determines the effective FrameVault plan for a profile given the Stripe
 * subscription status and underlying price.
 */
export function resolveProfilePlan(status: string | null | undefined, pricePlan: PaidPlan | null): Plan {
  if (isActiveStripeStatus(status) && pricePlan) {
    return pricePlan;
  }
  return "free";
}
