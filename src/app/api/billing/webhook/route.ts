import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import Stripe from "stripe";
import { apiError, apiJson } from "@/lib/api";
import { getServerEnv } from "@/env";
import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  isActiveStripeStatus,
  normaliseSubscriptionItems,
  resolvePendingSubscriptionPlan,
  resolveProfilePlan,
  resolveSubscriptionPlanCandidate,
  TERMINAL_SUBSCRIPTION_STATUSES,
  pickHigherPriorityPlan,
  getPlanFromPrice,
  type PaidPlan,
} from "@/lib/billing";
import { getStripeClient } from "@/lib/stripe";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service";
import type { Database, Plan } from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const relevantEvents = new Set<Stripe.Event.Type | string>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.created",
]);

const CANCELABLE_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>([
  ...ACTIVE_SUBSCRIPTION_STATUSES,
]);

const METADATA_PLAN_KEYS = ["plan", "target_plan", "framevault_plan", "requested_plan", "desired_plan"] as const;

const enableDebugLogs = process.env.NODE_ENV !== "production";

function extractCustomerId(
  customer: Stripe.Subscription["customer"] | Stripe.Checkout.Session.Customer | Stripe.Customer | Stripe.DeletedCustomer | string | null | undefined
) {
  if (!customer) return null;
  if (typeof customer === "string") return customer;
  if (typeof customer === "object" && "id" in customer && typeof customer.id === "string") {
    return customer.id;
  }
  return null;
}

function toIso(seconds: number | null | undefined): string | null {
  if (!seconds) return null;
  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function findActiveItem(items: Array<Stripe.SubscriptionItem | Stripe.DeletedSubscriptionItem> | undefined) {
  if (!items || items.length === 0) return null;
  const sorted = [...items].sort((a, b) => (b.created ?? 0) - (a.created ?? 0));
  for (const item of sorted) {
    if ("deleted" in item && item.deleted) continue;
    if (typeof item.quantity === "number" && item.quantity === 0) continue;
    return item as Stripe.SubscriptionItem;
  }
  return null;
}

function isDeletedSubscriptionItem(
  item: Stripe.SubscriptionItem | Stripe.DeletedSubscriptionItem
): item is Stripe.DeletedSubscriptionItem {
  return "deleted" in item && Boolean((item as Stripe.DeletedSubscriptionItem).deleted);
}

function isZeroDollarPrice(price: Stripe.Price | null | undefined): boolean {
  if (!price || typeof price !== "object") return false;
  if (typeof price.unit_amount === "number") {
    return price.unit_amount === 0;
  }
  if (typeof price.unit_amount_decimal === "string") {
    const numeric = Number(price.unit_amount_decimal);
    return Number.isFinite(numeric) && numeric === 0;
  }
  return false;
}

function toPaidPlan(value: Plan | null | undefined): PaidPlan | null {
  if (value === "plus" || value === "pro") {
    return value;
  }
  return null;
}

function readPlanFromMetadata(metadata: Stripe.Metadata | null | undefined): PaidPlan | null {
  if (!metadata) return null;
  for (const key of METADATA_PLAN_KEYS) {
    const value = metadata[key];
    if (value === "plus" || value === "pro") {
      return value;
    }
  }
  return null;
}

function debugLog(message: string, payload: Record<string, unknown>) {
  if (!enableDebugLogs) return;
  console.debug(`[billing:webhook] ${message}`, payload);
}

function resolvePriceId(items: Array<Stripe.SubscriptionItem | Stripe.DeletedSubscriptionItem> | undefined) {
  const item = findActiveItem(items);
  return item?.price?.id ?? null;
}

function normalisePlan(plan: PaidPlan | null, status: string): Plan {
  if (!plan) return "free";
  if (TERMINAL_SUBSCRIPTION_STATUSES.has(status as Stripe.Subscription.Status)) {
    return "free";
  }
  return plan;
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
        continue;
      }
      console.error("Failed to cancel stale subscription", subscription.id, error);
      throw error;
    }
  }
}

async function upsertSubscription(
  service: SupabaseClient<Database>,
  subscription: Stripe.Subscription,
  customerId: string | null,
  pendingItemsOverride?: Stripe.SubscriptionItem[]
) {
  const userId = subscription.metadata?.supabase_user_id ?? null;
  if (!userId) {
    console.warn("Subscription missing supabase_user_id metadata", subscription.id);
    return;
  }

  const { plan: resolvedPlan } = resolveSubscriptionPlanCandidate(subscription);
  const pendingPlan = resolvePendingSubscriptionPlan(subscription);
  const status = subscription.status;
  const isActive = isActiveStripeStatus(status);

  const providerValue = "stripe" as const;
  const subscriptionIdValue = subscription.id;
  const stripeSubscriptionIdValue = subscription.id;

  const matcherConfigs: Array<Array<{ column: string; value: string }>> = [];

  if (stripeSubscriptionIdValue) {
    matcherConfigs.push([
      { column: "user_id", value: userId },
      { column: "stripe_subscription_id", value: stripeSubscriptionIdValue },
    ]);
  }

  if (subscriptionIdValue) {
    matcherConfigs.push([
      { column: "provider", value: providerValue },
      { column: "subscription_id", value: subscriptionIdValue },
    ]);
  }

  const pendingUpdateItems = (pendingItemsOverride && pendingItemsOverride.length > 0
    ? pendingItemsOverride
    : normaliseSubscriptionItems(subscription.pending_update?.subscription_items)
  ).filter((item): item is Stripe.SubscriptionItem => !isDeletedSubscriptionItem(item));

  let existingSubscriptionId: string | null = null;
  let existingRowPlan: Plan | null = null;
  let existingRowPendingPlan: Plan | null = null;

  for (const config of matcherConfigs) {
    let query = service.from("subscriptions").select("id, plan, pending_plan");
    for (const { column, value } of config) {
      query = query.eq(column, value);
    }
    query = query.order("created_at", { ascending: false }).limit(1);

    const existing = await query;
    if (existing.error) {
      throw existing.error;
    }

    if (existing.data && existing.data.length > 0) {
      const row = existing.data[0] as { id: string; plan: Plan | null; pending_plan: Plan | null };
      existingSubscriptionId = row.id;
      existingRowPlan = row.plan;
      existingRowPendingPlan = row.pending_plan;
      break;
    }
  }

  const metadataPlan = readPlanFromMetadata(subscription.metadata);
  let planCandidate: Plan | null = null;
  if (resolvedPlan) {
    planCandidate = resolvedPlan;
  }
  if (metadataPlan) {
    planCandidate = planCandidate
      ? pickHigherPriorityPlan(planCandidate, metadataPlan)
      : metadataPlan;
  }
  if (!planCandidate) {
    planCandidate = toPaidPlan(existingRowPlan);
  }
  let planForRow = normalisePlan(planCandidate, status);

  const pendingPlanCandidateFromStripe = pendingPlan;
  const pendingPlanFromPrice = (() => {
    if (pendingPlanCandidateFromStripe) return null;
    const pendingPriceId = resolvePriceId(pendingUpdateItems);
    if (!pendingPriceId) return null;
    return getPlanFromPrice(pendingPriceId);
  })();

  const pendingPlanCandidate = pendingPlanCandidateFromStripe ?? pendingPlanFromPrice;
  const hasPendingFree = pendingUpdateItems.some((item) => isZeroDollarPrice(item.price));
  let pendingPlanForRow: Plan | null = isActive
    ? (pendingPlanCandidate ?? (hasPendingFree ? "free" : subscription.cancel_at_period_end ? "free" : null))
    : null;

  debugLog("pending subscription update inspection", {
    stripeSubscriptionId: stripeSubscriptionIdValue,
    hasPendingUpdate: Boolean(subscription.pending_update),
    pendingUpdateItems: pendingUpdateItems.map((item) => ({
      id: item.id,
      priceId: item.price?.id ?? null,
      quantity: item.quantity,
    })),
    pendingPlanCandidate,
    pendingPlanCandidateFromStripe,
    pendingPlanFromPrice,
    hasPendingFree,
    existingRowPendingPlan,
    derivedPendingPlanForRow: pendingPlanForRow,
  });

  const scheduledDowngrade: Plan | null = pendingPlanCandidate
    ? pendingPlanCandidate
    : hasPendingFree
      ? "free"
      : subscription.cancel_at_period_end
        ? "free"
        : null;

  const downgradeTarget = (scheduledDowngrade ?? planCandidate ?? null) as Plan | null;

  if (existingRowPlan && planForRow) {
    const higherPriority = pickHigherPriorityPlan(existingRowPlan, planForRow);
    const isDowngrade = higherPriority === existingRowPlan && planForRow !== existingRowPlan;

    if (isDowngrade && scheduledDowngrade) {
      planForRow = existingRowPlan;
      const candidatePending =
        scheduledDowngrade && scheduledDowngrade !== planForRow ? scheduledDowngrade : pendingPlanForRow;
      pendingPlanForRow = candidatePending;
    }
  }

  if (!scheduledDowngrade) {
    pendingPlanForRow = null;
  }

  debugLog("subscription plan resolution", {
    stripeSubscriptionId: stripeSubscriptionIdValue,
    status,
    resolvedPlan,
    metadataPlan,
    existingRowPlan,
    planCandidate,
    finalPlanForRow: planForRow,
    pendingPlan,
    existingRowPendingPlan,
    pendingPlanCandidate,
    scheduledDowngrade,
    downgradeTarget,
    pendingPlanForRow,
  });

  const basePayload = {
    user_id: userId,
    provider: providerValue,
    subscription_id: subscriptionIdValue,
    stripe_subscription_id: stripeSubscriptionIdValue,
    stripe_customer_id: customerId,
    plan: planForRow,
    status,
    price_id: resolvePriceId(subscription.items?.data),
    current_period_start: toIso(subscription.current_period_start),
    current_period_end: toIso(subscription.current_period_end),
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    cancel_at: toIso(subscription.cancel_at),
    ended_at: toIso(subscription.ended_at),
    pending_plan: pendingPlanForRow,
    pending_price_id: resolvePriceId(pendingUpdateItems),
    metadata: subscription.metadata ?? {},
  } satisfies Omit<Database["public"]["Tables"]["subscriptions"]["Insert"], "is_current">;

  const updatePayload = {
    ...basePayload,
    updated_at: new Date().toISOString(),
  };

  let affectedId: string | null = existingSubscriptionId;

  if (existingSubscriptionId) {
    const { error: updateError } = await service
      .from("subscriptions")
      .update(updatePayload)
      .eq("id", existingSubscriptionId);

    if (updateError) {
      throw updateError;
    }
  } else {
    const insertResult = await service
      .from("subscriptions")
      .insert(basePayload)
      .select("id")
      .maybeSingle();

    if (insertResult.error) {
      if (insertResult.error.code === "23505") {
        let retryQuery = service
          .from("subscriptions")
          .update(updatePayload)
          .eq("user_id", basePayload.user_id)
          .eq("stripe_subscription_id", basePayload.stripe_subscription_id);

        if (basePayload.subscription_id) {
          retryQuery = retryQuery.eq("subscription_id", basePayload.subscription_id);
        }

        const { error: retryError } = await retryQuery;

        if (retryError) {
          throw retryError;
        }

        const resolved = await service
          .from("subscriptions")
          .select("id")
          .eq("user_id", basePayload.user_id)
          .eq("stripe_subscription_id", basePayload.stripe_subscription_id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (resolved.error) {
          throw resolved.error;
        }

        if (resolved.data && resolved.data.length > 0) {
          affectedId = (resolved.data[0] as { id: string }).id;
        }
      } else {
        throw insertResult.error;
      }
    } else {
      affectedId = insertResult.data?.id ?? null;
    }
  }

  if (!affectedId) {
    const resolved = await service
      .from("subscriptions")
      .select("id")
      .eq("user_id", basePayload.user_id)
      .eq("stripe_subscription_id", basePayload.stripe_subscription_id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (resolved.error) {
      throw resolved.error;
    }

    if (resolved.data && resolved.data.length > 0) {
      affectedId = (resolved.data[0] as { id: string }).id;
    }
  }

  if (!affectedId) {
    throw new Error("Unable to resolve subscription row id after upsert");
  }

  debugLog("subscription row upserted", {
    stripeSubscriptionId: stripeSubscriptionIdValue,
    affectedId,
    plan: basePayload.plan,
    pendingPlan: basePayload.pending_plan,
    status,
    isActive,
  });

  const { error: flagError } = await service
    .from("subscriptions")
    .update({ is_current: isActive, updated_at: new Date().toISOString() })
    .eq("id", affectedId);

  if (flagError) {
    throw flagError;
  }

  debugLog("subscription row flagged current", {
    stripeSubscriptionId: stripeSubscriptionIdValue,
    affectedId,
    isActive,
  });

  if (isActive) {
    await service
      .from("subscriptions")
      .update({ is_current: false })
      .eq("user_id", userId)
      .eq("provider", providerValue)
      .neq("subscription_id", subscriptionIdValue);
  }

  if (customerId) {
    const { error: profileError } = await service
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", userId);
    if (profileError) throw profileError;
  }
}

async function loadExpandedSubscription(stripe: Stripe, subscription: Stripe.Subscription) {
  const expanded = await stripe.subscriptions.retrieve(subscription.id, {
    expand: [
      "items.data.price",
      "items.data.price.product",
      "items.data.plan",
      "pending_update.subscription_items",
    ],
  });

  let pendingItems: Stripe.SubscriptionItem[] = [];

  if (expanded.pending_update) {
    const pendingList = await stripe.subscriptionItems.list({
      subscription: expanded.id,
      pending: true,
      expand: ["data.price", "data.price.product"],
    });

    pendingItems = pendingList.data as Stripe.SubscriptionItem[];

    expanded.pending_update = {
      ...expanded.pending_update,
      subscription_items: pendingList as Stripe.ApiList<Stripe.SubscriptionItem | Stripe.DeletedSubscriptionItem>,
    } as Stripe.SubscriptionPendingUpdate;
  }

  return { subscription: expanded, pendingItems };
}

async function handleSubscriptionEvent(
  service: SupabaseClient<Database>,
  stripe: Stripe,
  subscription: Stripe.Subscription
) {
  const { subscription: expanded, pendingItems } = await loadExpandedSubscription(stripe, subscription);
  const customerId = extractCustomerId(expanded.customer);

  await upsertSubscription(service, expanded, customerId, pendingItems);

  if (customerId && expanded.id && isActiveStripeStatus(expanded.status)) {
    await cancelOtherSubscriptions(stripe, customerId, expanded.id);
  }

  const userId = expanded.metadata?.supabase_user_id ?? null;
  if (!userId) {
    return;
  }

  const { data: profileRow, error } = await service
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;

  const plan = resolveProfilePlan(expanded.status, resolveSubscriptionPlanCandidate(expanded).plan, {
    cancelAtPeriodEnd: expanded.cancel_at_period_end,
    endedAt: expanded.ended_at,
  });

  debugLog("apply_subscription_change invoked", {
    userId,
    stripeSubscriptionId: expanded.id,
    plan,
    status: expanded.status,
  });

  const { error: applyError } = await service.rpc("apply_subscription_change", { target_user: userId });
  if (applyError) throw applyError;

  debugLog("apply_subscription_change completed", {
    userId,
    stripeSubscriptionId: expanded.id,
  });

  if (plan === "free") {
    const { error: computeError } = await service.rpc("compute_effective_plan", { target_user: userId });
    if (computeError) throw computeError;
  }

  revalidateBillingViews(profileRow?.username ?? null);
}

async function handleCustomerCreated(
  service: SupabaseClient<Database>,
  customer: Stripe.Customer
) {
  const userId = customer.metadata?.supabase_user_id ?? null;
  if (!userId || customer.deleted) return;
  const { error } = await service
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId)
    .is("stripe_customer_id", null);
  if (error) throw error;
}

async function recordEvent(service: SupabaseClient<Database>, event: Stripe.Event) {
  const { error } = await service
    .from("stripe_webhook_events")
    .insert({ event_id: event.id, event_type: event.type });
  if (error) throw error;
}

export async function POST(request: NextRequest) {
  const env = getServerEnv();
  const {
    STRIPE_SECRET_KEY,
    BILLING_WEBHOOK_SECRET,
    STRIPE_WEBHOOK_SECRET,
  } = env;

  const webhookSecret = BILLING_WEBHOOK_SECRET ?? STRIPE_WEBHOOK_SECRET;

  if (!STRIPE_SECRET_KEY || !webhookSecret) {
    return apiError("billing_disabled", "Billing webhook misconfigured", 503);
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
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("Billing webhook signature verification failed", error);
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
    console.error("Webhook idempotency query failed", existingError);
    return apiError("internal_error", "Unable to verify webhook idempotency", 500);
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
              "pending_update.subscription_items",
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
    console.error("Billing webhook processing error", event.type, error);
    return apiError("internal_error", "Failed to process webhook", 500);
  }

  try {
    await recordEvent(service, event);
  } catch (error) {
    console.error("Failed to record webhook idempotency", error);
    return apiError("internal_error", "Unable to record webhook", 500);
  }

  return apiJson({ received: true });
}
