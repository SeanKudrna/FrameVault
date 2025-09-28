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

const PLAN_RANK: Record<Plan, number> = {
  free: 0,
  plus: 1,
  pro: 2,
};

export const ACTIVE_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
]);

export const TERMINAL_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>([
  "canceled",
  "incomplete_expired",
]);

const METADATA_PLAN_KEYS = ["plan", "target_plan", "framevault_plan", "requested_plan", "desired_plan"] as const;

function coercePlan(value: unknown): PaidPlan | null {
  if (value === "plus" || value === "pro") {
    return value;
  }
  return null;
}

function readMetadataPlan(metadata: Stripe.Metadata | null | undefined): PaidPlan | null {
  if (!metadata) return null;
  for (const key of METADATA_PLAN_KEYS) {
    const candidate = coercePlan(metadata[key]);
    if (candidate) {
      return candidate;
    }
  }
  return null;
}

function readPlanFromPrice(price: Stripe.Price | null | undefined): PaidPlan | null {
  if (!price) return null;
  const pricePlan = getPlanFromPrice(price.id);
  if (pricePlan) return pricePlan;
  return readMetadataPlan(price.metadata);
}

function readPlanFromProduct(
  product: Stripe.Product | Stripe.DeletedProduct | string | null | undefined
): PaidPlan | null {
  if (!product || typeof product !== "object") return null;
  if ("deleted" in product && product.deleted) return null;
  if ("metadata" in product && product.metadata) {
    return readMetadataPlan(product.metadata);
  }
  return null;
}

function isDeletedSubscriptionItem(
  item: Stripe.SubscriptionItem | Stripe.DeletedSubscriptionItem
): item is Stripe.DeletedSubscriptionItem {
  return "deleted" in item && Boolean(item.deleted);
}

function isApiList<T>(value: unknown): value is Stripe.ApiList<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "data" in value &&
    Array.isArray((value as { data?: unknown }).data)
  );
}

export function normaliseSubscriptionItems(
  items:
    | Array<Stripe.SubscriptionItem | Stripe.DeletedSubscriptionItem>
    | Stripe.ApiList<Stripe.SubscriptionItem | Stripe.DeletedSubscriptionItem>
    | null
    | undefined
): Array<Stripe.SubscriptionItem | Stripe.DeletedSubscriptionItem> {
  if (!items) return [];
  if (Array.isArray(items)) return items;
  if (isApiList<Stripe.SubscriptionItem | Stripe.DeletedSubscriptionItem>(items)) {
    return items.data;
  }
  return [];
}

function resolvePlanFromSubscriptionItems(items: Stripe.SubscriptionItem[] | undefined): PaidPlan | null {
  if (!items || items.length === 0) {
    return null;
  }

  const sorted = [...items].sort((a, b) => (b.created ?? 0) - (a.created ?? 0));

  for (const item of sorted) {
    if (isDeletedSubscriptionItem(item)) continue;
    if (typeof item.quantity === "number" && item.quantity === 0) continue;
    const plan = readPlanFromPrice(item.price) ?? readPlanFromProduct(item.price?.product);
    if (plan) return plan;
  }

  for (const item of sorted) {
    if (isDeletedSubscriptionItem(item)) continue;
    if (typeof item.quantity === "number" && item.quantity === 0) continue;
    const plan =
      readMetadataPlan(item.metadata) ??
      readMetadataPlan(item.price?.metadata) ??
      readPlanFromProduct(item.price?.product) ??
      (item.plan && "metadata" in item.plan ? readMetadataPlan(item.plan.metadata) : null);
    if (plan) return plan;
  }

  return null;
}

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

/**
 * Returns whether a Stripe subscription status should be considered active for
 * gating purposes. `past_due` remains active to avoid prematurely locking
 * members out while Stripe handles retries.
 */
export function isActiveStripeStatus(status: string | null | undefined) {
  if (!status) return false;
  return ACTIVE_SUBSCRIPTION_STATUSES.has(status as Stripe.Subscription.Status);
}

export interface ResolveProfilePlanOptions {
  cancelAtPeriodEnd?: boolean | null | undefined;
  endedAt?: number | null | undefined;
}

/**
 * Determines the effective FrameVault plan for a profile given the Stripe
 * subscription status and underlying price information.
 */
export function resolveProfilePlan(
  status: string | null | undefined,
  pricePlan: PaidPlan | null,
  options: ResolveProfilePlanOptions = {}
): Plan {
  if (!pricePlan) {
    return "free";
  }

  if (!status) {
    return "free";
  }

  if (options.endedAt) {
    return "free";
  }

  if (TERMINAL_SUBSCRIPTION_STATUSES.has(status as Stripe.Subscription.Status)) {
    return "free";
  }

  if (isActiveStripeStatus(status)) {
    return pricePlan;
  }

  return "free";
}

export type SubscriptionPlanSource = "price" | "metadata";

export interface SubscriptionPlanResolution {
  plan: PaidPlan | null;
  source: SubscriptionPlanSource | null;
}

/**
 * Attempts to determine the plan scheduled to take effect after the current
 * billing period. Relies on Stripe's pending update metadata when present.
 */
export function resolvePendingSubscriptionPlan(subscription: Stripe.Subscription): PaidPlan | null {
  const pendingItemsRaw = normaliseSubscriptionItems(subscription.pending_update?.subscription_items);
  const pendingItems = pendingItemsRaw.filter(
    (item): item is Stripe.SubscriptionItem => !isDeletedSubscriptionItem(item)
  );

  if (pendingItems.length > 0) {
    const pendingFromItems = resolvePlanFromSubscriptionItems(pendingItems);
    if (pendingFromItems) {
      return pendingFromItems;
    }
  }

  const metadataPlan =
    readMetadataPlan(subscription.pending_update?.metadata) ??
    readMetadataPlan(pendingItems[0]?.metadata ?? null) ??
    (subscription.pending_update?.schedule &&
    typeof subscription.pending_update.schedule === "object" &&
    subscription.pending_update.schedule !== null &&
    "metadata" in subscription.pending_update.schedule
      ? readMetadataPlan(
          (subscription.pending_update.schedule as Stripe.SubscriptionSchedule).metadata ?? null
        )
      : null);

  return metadataPlan;
}

/**
 * Attempts to determine the target FrameVault plan for a Stripe subscription.
 * Prefers the newest non-deleted subscription item price before falling back to
 * metadata hints.
 */
export function resolveSubscriptionPlanCandidate(
  subscription: Stripe.Subscription
): SubscriptionPlanResolution {
  const items = subscription.items?.data ?? [];
  const itemPlan = resolvePlanFromSubscriptionItems(items);
  if (itemPlan) {
    return { plan: itemPlan, source: "price" };
  }

  const pendingItemPlan = resolvePlanFromSubscriptionItems(
    normaliseSubscriptionItems(subscription.pending_update?.subscription_items).filter(
      (item): item is Stripe.SubscriptionItem => !isDeletedSubscriptionItem(item)
    )
  );
  if (pendingItemPlan) {
    return { plan: pendingItemPlan, source: "price" };
  }

  const metadataPlan =
    readMetadataPlan(subscription.metadata) ??
    readMetadataPlan(subscription.pending_update?.metadata) ??
    (subscription.plan && "metadata" in subscription.plan
      ? readMetadataPlan(subscription.plan.metadata)
      : null);

  if (metadataPlan) {
    return { plan: metadataPlan, source: "metadata" };
  }

  return { plan: null, source: null };
}

/**
 * Chooses the higher priority plan between two options. Helpful when comparing
 * multiple subscription snapshots. Returns the second plan when priorities
 * match to favour the most recent signal.
 */
export function pickHigherPriorityPlan(current: Plan, candidate: Plan): Plan {
  const currentRank = PLAN_RANK[current];
  const candidateRank = PLAN_RANK[candidate];
  if (candidateRank >= currentRank) {
    return candidate;
  }
  return current;
}
