/**
 * Stripe webhook handler responsible for syncing subscription status back into
 * Supabase. Handles checkout completions, subscription lifecycle events, and
 * idempotency via a dedicated table.
 */

import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import Stripe from "stripe";
import { apiError, apiJson } from "@/lib/api";
import { getServerEnv } from "@/env";
import {
  isActiveStripeStatus,
  resolveProfilePlan,
  resolveSubscriptionPlanCandidate,
  type PaidPlan,
} from "@/lib/billing";
import { getStripeClient } from "@/lib/stripe";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const relevantEvents = new Set<Stripe.Event.Type | string>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.created",
]);

const CANCELABLE_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
]);

function extractCustomerId(customer: Stripe.Subscription["customer"] | Stripe.Checkout.Session.Customer | Stripe.Customer | Stripe.DeletedCustomer | string | null | undefined) {
  if (!customer) return null;
  if (typeof customer === "string") return customer;
  if (typeof customer === "object" && "id" in customer && typeof customer.id === "string") {
    return customer.id;
  }
  return null;
}

interface SaveSubscriptionArgs {
  service: SupabaseClient<Database>;
  userId: string;
  customerId: string | null;
  subscriptionId: string | null;
  plan: PaidPlan | "free";
  status: string;
  currentPeriodEnd: string | null;
}

async function saveSubscription({
  service,
  userId,
  customerId,
  subscriptionId,
  plan,
  status,
  currentPeriodEnd,
}: SaveSubscriptionArgs): Promise<boolean> {
  const existing = await service
    .from("subscriptions")
    .select("id, stripe_subscription_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing.error) throw existing.error;

  const currentSubscriptionId = existing.data?.stripe_subscription_id ?? null;
  const incomingSubscriptionId = subscriptionId ?? null;
  const isActive = isActiveStripeStatus(status);

  if (
    existing.data &&
    currentSubscriptionId &&
    incomingSubscriptionId &&
    currentSubscriptionId !== incomingSubscriptionId &&
    !isActive
  ) {
    // Ignore stale events for previously canceled subscriptions so we keep
    // the latest active subscription details associated with the user.
    return false;
  }

  const payload = {
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    plan,
    status,
    current_period_end: currentPeriodEnd,
  };

  if (existing.data) {
    const { error } = await service
      .from("subscriptions")
      .update(payload)
      .eq("id", existing.data.id);
    if (error) throw error;
    return true;
  } else {
    const { error } = await service.from("subscriptions").insert(payload);
    if (error) {
      if (error.code === "23505") {
        const retry = await service
          .from("subscriptions")
          .update(payload)
          .eq("user_id", userId);
        if (retry.error) throw retry.error;
        return true;
      } else {
        throw error;
      }
    }
  }

  return true;
}

async function updateProfilePlan(
  service: SupabaseClient<Database>,
  userId: string,
  plan: PaidPlan | "free",
  customerId: string | null
) {
  const updates: Partial<Database["public"]["Tables"]["profiles"]["Update"]> = { plan };
  if (customerId) {
    updates.stripe_customer_id = customerId;
  }
  const { error } = await service.from("profiles").update(updates).eq("id", userId);
  if (error) throw error;
}

function revalidateBillingViews(username?: string | null) {
  try {
    revalidatePath("/app");
    revalidatePath("/settings/billing");
    revalidatePath("/settings/profile");
    if (username) {
      revalidatePath(`/c/${username}`);
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Billing webhook revalidate failed", error);
    }
  }
}

async function cancelOtherSubscriptions(
  stripe: Stripe,
  customerId: string,
  subscriptionIdToKeep: string
) {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  });

  for (const subscription of subscriptions.data) {
    if (subscription.id === subscriptionIdToKeep) continue;
    if (subscription.status === "canceled") continue;
    if (!CANCELABLE_SUBSCRIPTION_STATUSES.has(subscription.status)) continue;

    try {
      await stripe.subscriptions.cancel(subscription.id);
    } catch (error) {
      const code =
        typeof error === "object" && error && "code" in error
          ? (error as { code?: string }).code
          : undefined;
      if (code === "resource_missing") {
        console.warn(
          "Stale subscription already canceled",
          subscription.id
        );
        continue;
      }
      console.error("Failed to cancel stale subscription", subscription.id, error);
      throw error;
    }
  }
}

async function handleSubscriptionEvent(
  service: SupabaseClient<Database>,
  stripe: Stripe,
  subscription: Stripe.Subscription
) {
  const userId = subscription.metadata?.supabase_user_id ?? null;
  if (!userId) {
    console.warn("Stripe subscription missing supabase_user_id metadata", subscription.id);
    return;
  }

  const status = subscription.status;
  const { plan: resolvedPlan, source: planSource } = resolveSubscriptionPlanCandidate(subscription);

  if (!resolvedPlan && process.env.NODE_ENV !== "production") {
    console.warn(
      "Stripe subscription did not expose a recognizable plan",
      subscription.id,
      { status, planSource }
    );
  }

  const currentPeriodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;
  const customerId = extractCustomerId(subscription.customer);
  const effectivePlan = resolveProfilePlan(status, resolvedPlan, {
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    endedAt: subscription.ended_at,
  });

  const { data: profileRow } = await service
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .maybeSingle();

  const persisted = await saveSubscription({
    service,
    userId,
    customerId,
    subscriptionId: subscription.id,
    plan: resolvedPlan ?? "free",
    status,
    currentPeriodEnd,
  });

  if (!persisted) {
    return;
  }

  await updateProfilePlan(service, userId, effectivePlan, customerId);

  if (customerId && subscription.id && isActiveStripeStatus(status)) {
    try {
      await cancelOtherSubscriptions(stripe, customerId, subscription.id);
    } catch (error) {
      console.error("Failed to enforce single active subscription", error);
      throw error;
    }
  }
  revalidateBillingViews(profileRow?.username ?? null);
}

async function handleCustomerCreated(
  service: SupabaseClient<Database>,
  customer: Stripe.Customer
) {
  const userId = customer.metadata?.supabase_user_id ?? null;
  if (!userId) return;
  const customerId = customer.deleted ? null : customer.id;
  if (!customerId) return;
  const { error } = await service
    .from("profiles")
    .update({ stripe_customer_id: customerId })
    .eq("id", userId)
    .is("stripe_customer_id", null);
  if (error) throw error;
}

export async function POST(request: NextRequest) {
  const env = getServerEnv();
  const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } = env;
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    return apiError("billing_disabled", "Stripe webhook not configured", 503);
  }

  const stripe = getStripeClient();
  const service = getSupabaseServiceRoleClient();

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return apiError("invalid_request", "Missing Stripe signature", 400);
  }

  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error);
    return apiError("invalid_signature", "Invalid Stripe signature", 400);
  }

  if (!relevantEvents.has(event.type)) {
    return apiJson({ received: true });
  }

  const { data: existing, error: existingError } = await service
    .from("stripe_webhook_events")
    .select("id")
    .eq("event_id", event.id)
    .maybeSingle();

  if (existingError) {
    console.error("Unable to check webhook idempotency", existingError);
    return apiError("internal_error", "Failed to inspect webhook state", 500);
  }

  if (existing) {
    return apiJson({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null;
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
            expand: [
              "items.data.price",
              "items.data.plan",
              "pending_update.subscription_items.data.price",
              "pending_update.subscription_items.data.plan",
            ],
          });
          await handleSubscriptionEvent(service, stripe, subscription);
        }
        const customerId = extractCustomerId(session.customer);
        const userId = session.metadata?.supabase_user_id ?? null;
        if (userId && customerId) {
          const { error } = await service
            .from("profiles")
            .update({ stripe_customer_id: customerId })
            .eq("id", userId);
          if (error) throw error;
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionEvent(service, stripe, subscription);
        break;
      }
      case "customer.created": {
        const customer = event.data.object as Stripe.Customer;
        await handleCustomerCreated(service, customer);
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("Stripe webhook processing error", event.type, error);
    return apiError("internal_error", "Failed to process webhook", 500);
  }

  const { error } = await service
    .from("stripe_webhook_events")
    .insert({ event_id: event.id, event_type: event.type });
  if (error) {
    console.error("Failed to record webhook idempotency", error);
    return apiError("internal_error", "Unable to record webhook", 500);
  }

  return apiJson({ received: true });
}
