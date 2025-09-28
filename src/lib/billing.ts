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

function coercePlanIncludingFree(value: unknown): Plan | null {
  if (value === "free" || value === "plus" || value === "pro") {
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

function readMetadataPlanIncludingFree(metadata: Stripe.Metadata | null | undefined): Plan | null {
  if (!metadata) return null;
  for (const key of METADATA_PLAN_KEYS) {
    const candidate = coercePlanIncludingFree(metadata[key]);
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

function readPlanFromProductIncludingFree(
  product: Stripe.Product | Stripe.DeletedProduct | string | null | undefined
): Plan | null {
  if (!product || typeof product !== "object") return null;
  if ("deleted" in product && product.deleted) return null;
  if ("metadata" in product && product.metadata) {
    return readMetadataPlanIncludingFree(product.metadata);
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

function resolvePlanFromSubscriptionItemsIncludingFree(items: Stripe.SubscriptionItem[] | undefined): Plan | null {
  const paidPlan = resolvePlanFromSubscriptionItems(items);
  if (paidPlan) {
    return paidPlan;
  }

  if (!items || items.length === 0) {
    return null;
  }

  const sorted = [...items].sort((a, b) => (b.created ?? 0) - (a.created ?? 0));

  for (const item of sorted) {
    if (isDeletedSubscriptionItem(item)) continue;
    if (typeof item.quantity === "number" && item.quantity === 0) continue;

    if (item.price && typeof item.price === "object" && isZeroAmountLike(item.price)) {
      return "free";
    }

    const metadataPlan =
      readMetadataPlanIncludingFree(item.metadata) ??
      (item.price && typeof item.price === "object"
        ? readMetadataPlanIncludingFree(item.price.metadata)
        : null) ??
      readPlanFromProductIncludingFree(
        item.price && typeof item.price === "object" ? item.price.product : null
      ) ??
      (item.plan && typeof item.plan === "object" && "metadata" in item.plan
        ? readMetadataPlanIncludingFree((item.plan as Stripe.Plan).metadata)
        : null);

    if (metadataPlan) {
      return metadataPlan;
    }
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

function isZeroAmountLike(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const price = value as { unit_amount?: number | null; unit_amount_decimal?: string | null };
  if (typeof price.unit_amount === "number") {
    return price.unit_amount === 0;
  }

  if (typeof price.unit_amount_decimal === "string") {
    const numeric = Number(price.unit_amount_decimal);
    if (Number.isFinite(numeric)) {
      return numeric === 0;
    }
  }

  return false;
}

function resolvePlanFromSchedulePhaseItems(
  items: Stripe.SubscriptionSchedulePhaseItem[] | null | undefined
): Plan | null {
  if (!items || items.length === 0) {
    return null;
  }

  for (const item of items) {
    if (!item) continue;
    const quantity = typeof item.quantity === "number" ? item.quantity : 1;
    if (quantity === 0) continue;

    if (typeof item.price === "string") {
      const planFromId = getPlanFromPrice(item.price);
      if (planFromId) {
        return planFromId;
      }
    } else if (item.price && typeof item.price === "object") {
      const priceObject = item.price as Stripe.Price;
      const planFromPrice =
        getPlanFromPrice(priceObject.id) ??
        readMetadataPlanIncludingFree(priceObject.metadata) ??
        readPlanFromProduct(priceObject.product);
      if (planFromPrice) {
        return planFromPrice;
      }
      if (isZeroAmountLike(priceObject)) {
        return "free";
      }
    }

    if (item.price_data) {
      const planFromPriceData = readMetadataPlanIncludingFree(item.price_data.metadata ?? null);
      if (planFromPriceData) {
        return planFromPriceData;
      }
      if (isZeroAmountLike(item.price_data)) {
        return "free";
      }
    }

    const metadataPlan =
      readMetadataPlanIncludingFree(item.metadata ?? null) ??
      (item.plan && typeof item.plan === "object" && "metadata" in item.plan
        ? readMetadataPlanIncludingFree((item.plan as Stripe.Plan).metadata)
        : null);
    if (metadataPlan) {
      return metadataPlan;
    }
  }

  return null;
}

function resolvePlanFromSchedule(
  scheduleInput: Stripe.Subscription["schedule"] | Stripe.SubscriptionPendingUpdate["schedule"],
  currentPlan: Plan | null
): Plan | null {
  if (!scheduleInput || typeof scheduleInput === "string") {
    return null;
  }

  const schedule = scheduleInput as Stripe.SubscriptionSchedule;
  const phases = Array.isArray(schedule.phases) ? schedule.phases : [];
  if (phases.length === 0) {
    return null;
  }

  const currentPhase = schedule.current_phase ?? null;
  let upcoming: Stripe.SubscriptionSchedulePhase | null = null;

  if (currentPhase) {
    const index = phases.findIndex((phase) => {
      return (
        (phase.start_date ?? null) === (currentPhase.start_date ?? null) &&
        (phase.end_date ?? null) === (currentPhase.end_date ?? null)
      );
    });
    if (index >= 0 && index + 1 < phases.length) {
      upcoming = phases[index + 1];
    }
  }

  if (!upcoming) {
    const now = Math.floor(Date.now() / 1000);
    upcoming = phases.find((phase) => typeof phase.start_date === "number" && phase.start_date > now) ?? null;
  }

  if (!upcoming && phases.length > 1) {
    upcoming = phases[phases.length - 1];
  }

  if (!upcoming) {
    return null;
  }

  const candidatePlan =
    resolvePlanFromSchedulePhaseItems(upcoming.items ?? []) ??
    readMetadataPlanIncludingFree(upcoming.metadata ?? null);

  if (candidatePlan) {
    if (currentPlan && candidatePlan === currentPlan) {
      return null;
    }
    return candidatePlan;
  }

  if (upcoming.items && upcoming.items.length > 0) {
    const hasZeroPrice = upcoming.items.some((item) => {
      if (!item) return false;
      if (typeof item.price === "string") return false;
      if (item.price && typeof item.price === "object" && isZeroAmountLike(item.price)) {
        return true;
      }
      if (item.price_data && isZeroAmountLike(item.price_data)) {
        return true;
      }
      return false;
    });
    if (hasZeroPrice) {
      return "free";
    }
  }

  return null;
}

function resolveCurrentPlanFromSchedule(
  scheduleInput: Stripe.Subscription["schedule"] | Stripe.SubscriptionPendingUpdate["schedule"]
): Plan | null {
  if (!scheduleInput || typeof scheduleInput === "string") {
    return null;
  }

  const schedule = scheduleInput as Stripe.SubscriptionSchedule;
  const phases = Array.isArray(schedule.phases) ? schedule.phases : [];
  if (phases.length === 0) {
    return null;
  }

  const currentPhaseRef = schedule.current_phase ?? null;
  let currentPhase: Stripe.SubscriptionSchedulePhase | null = null;

  if (currentPhaseRef) {
    currentPhase = phases.find((phase) => {
      return (
        (phase?.start_date ?? null) === (currentPhaseRef.start_date ?? null) &&
        (phase?.end_date ?? null) === (currentPhaseRef.end_date ?? null)
      );
    }) ?? null;
  }

  if (!currentPhase) {
    currentPhase = phases[0] ?? null;
  }

  if (!currentPhase) {
    return null;
  }

  const planFromPhase =
    resolvePlanFromSchedulePhaseItems(currentPhase.items ?? []) ??
    readMetadataPlanIncludingFree(currentPhase.metadata ?? null);

  return planFromPhase;
}

/**
 * Attempts to determine the plan scheduled to take effect after the current
 * billing period. Relies on Stripe's pending update metadata when present.
 */
export function resolvePendingSubscriptionPlan(subscription: Stripe.Subscription): Plan | null {
  const currentItems = normaliseSubscriptionItems(subscription.items).filter(
    (item): item is Stripe.SubscriptionItem => !isDeletedSubscriptionItem(item)
  );
  let currentPlan: Plan | null = resolvePlanFromSubscriptionItemsIncludingFree(currentItems);

  const scheduleCurrentPlan =
    resolveCurrentPlanFromSchedule(subscription.schedule) ??
    resolveCurrentPlanFromSchedule(subscription.pending_update?.schedule);

  if (scheduleCurrentPlan) {
    currentPlan = scheduleCurrentPlan;
  }

  const pendingItemsRaw = normaliseSubscriptionItems(subscription.pending_update?.subscription_items);
  const pendingItems = pendingItemsRaw.filter(
    (item): item is Stripe.SubscriptionItem => !isDeletedSubscriptionItem(item)
  );

  if (pendingItems.length > 0) {
    const pendingFromItems = resolvePlanFromSubscriptionItemsIncludingFree(pendingItems);
    if (pendingFromItems) {
      if (currentPlan && pendingFromItems === currentPlan) {
        return null;
      }
      return pendingFromItems;
    }
  }

  const scheduleFromPendingUpdate = resolvePlanFromSchedule(
    subscription.pending_update?.schedule,
    currentPlan
  );
  if (scheduleFromPendingUpdate) {
    return scheduleFromPendingUpdate;
  }

  const schedulePlan = resolvePlanFromSchedule(subscription.schedule, currentPlan);
  if (schedulePlan) {
    return schedulePlan;
  }

  const metadataPlan =
    readMetadataPlanIncludingFree(subscription.pending_update?.metadata) ??
    readMetadataPlanIncludingFree(pendingItems[0]?.metadata ?? null) ??
    readMetadataPlanIncludingFree(subscription.metadata);

  if (metadataPlan && (!currentPlan || metadataPlan !== currentPlan)) {
    return metadataPlan;
  }

  return null;
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

export function resolveSubscriptionPlanIncludingFree(subscription: Stripe.Subscription): Plan | null {
  const items = normaliseSubscriptionItems(subscription.items).filter(
    (item): item is Stripe.SubscriptionItem => !isDeletedSubscriptionItem(item)
  );

  let planCandidate = resolvePlanFromSubscriptionItemsIncludingFree(items);

  const scheduleCurrentPlan =
    resolveCurrentPlanFromSchedule(subscription.schedule) ??
    resolveCurrentPlanFromSchedule(subscription.pending_update?.schedule);

  if (scheduleCurrentPlan) {
    planCandidate = planCandidate
      ? pickHigherPriorityPlan(planCandidate, scheduleCurrentPlan)
      : scheduleCurrentPlan;
  }

  if (planCandidate) {
    return planCandidate;
  }

  const metadataPlan =
    readMetadataPlanIncludingFree(subscription.metadata) ??
    (subscription.plan && "metadata" in subscription.plan && subscription.plan?.metadata
      ? readMetadataPlanIncludingFree(subscription.plan.metadata)
      : null);

  if (metadataPlan) {
    return metadataPlan;
  }

  return null;
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
