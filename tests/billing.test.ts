import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import {
  STRIPE_PRICE_IDS,
  isActiveStripeStatus,
  resolveProfilePlan,
  resolveSubscriptionPlanCandidate,
} from "@/lib/billing";

function createSubscriptionItem(options: {
  id: string;
  priceId: string;
  created: number;
  quantity?: number;
  priceMetadata?: Stripe.Metadata;
  itemMetadata?: Stripe.Metadata;
}): Stripe.SubscriptionItem {
  const { id, priceId, created, quantity = 1, priceMetadata, itemMetadata } = options;
  return {
    id,
    object: "subscription_item",
    billing_thresholds: null,
    created,
    metadata: itemMetadata ?? {},
    plan: {
      id: `plan_${id}`,
      object: "plan",
      active: true,
      aggregate_usage: null,
      amount: null,
      amount_decimal: null,
      billing_scheme: "per_unit",
      created,
      currency: "usd",
      interval: "month",
      interval_count: 1,
      livemode: false,
      metadata: {},
      nickname: null,
      product: "prod_123",
      tiers_mode: null,
      transform_usage: null,
      trial_period_days: null,
      usage_type: "licensed",
    },
    price: {
      id: priceId,
      object: "price",
      active: true,
      billing_scheme: "per_unit",
      created,
      currency: "usd",
      custom_unit_amount: null,
      livemode: false,
      lookup_key: null,
      metadata: priceMetadata ?? {},
      nickname: null,
      product: "prod_123",
      recurring: {
        aggregate_usage: null,
        interval: "month",
        interval_count: 1,
        trial_period_days: null,
        usage_type: "licensed",
      },
      tax_behavior: "unspecified",
      tiers_mode: null,
      transform_quantity: null,
      type: "recurring",
      unit_amount: 0,
      unit_amount_decimal: "0",
    },
    quantity,
    subscription: "sub_123",
    tax_rates: [],
  } as Stripe.SubscriptionItem;
}

function createSubscription(partial: Partial<Stripe.Subscription>): Stripe.Subscription {
  return {
    id: partial.id ?? "sub_123",
    object: "subscription",
    application: null,
    application_fee_percent: null,
    automatic_tax: { enabled: false, liability: null },
    billing_cycle_anchor: 0,
    billing_thresholds: null,
    cancel_at: null,
    cancel_at_period_end: false,
    canceled_at: null,
    cancellation_details: { comment: null, feedback: null, reason: null },
    collection_method: "charge_automatically",
    created: 0,
    currency: "usd",
    current_period_end: 0,
    current_period_start: 0,
    customer: partial.customer ?? "cus_123",
    days_until_due: null,
    default_payment_method: null,
    default_source: null,
    default_tax_rates: [],
    description: null,
    discount: null,
    ended_at: null,
    invoice_settings: { issuer: null },
    items: {
      object: "list",
      data: [],
      has_more: false,
      url: "/v1/subscriptions/sub_123/items",
    },
    latest_invoice: null,
    livemode: false,
    metadata: {},
    next_pending_invoice_item_invoice: null,
    on_behalf_of: null,
    pause_collection: null,
    payment_settings: {
      payment_method_options: null,
      payment_method_types: null,
      save_default_payment_method: "off",
    },
    pending_invoice_item_interval: null,
    pending_setup_intent: null,
    pending_update: null,
    plan: null,
    quantity: null,
    schedule: null,
    start_date: 0,
    status: "active",
    test_clock: null,
    transfer_data: null,
    trial_end: null,
    trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
    trial_start: null,
    ...partial,
  } as Stripe.Subscription;
}

describe("resolveSubscriptionPlanCandidate", () => {
  it("prefers the newest active subscription item price", () => {
    const plusItem = createSubscriptionItem({
      id: "si_plus",
      priceId: STRIPE_PRICE_IDS.plus,
      created: 1_000,
    });
    const proItem = createSubscriptionItem({
      id: "si_pro",
      priceId: STRIPE_PRICE_IDS.pro,
      created: 2_000,
    });

    const subscription = createSubscription({
      items: {
        object: "list",
        data: [plusItem, proItem],
        has_more: false,
        url: "/v1/subscriptions/sub_123/items",
      },
    });

    const resolution = resolveSubscriptionPlanCandidate(subscription);
    expect(resolution.plan).toBe("pro");
    expect(resolution.source).toBe("price");
  });

  it("ignores stale items with zero quantity", () => {
    const plusItem = createSubscriptionItem({
      id: "si_plus_old",
      priceId: STRIPE_PRICE_IDS.plus,
      created: 1_000,
      quantity: 0,
    });
    const proItem = createSubscriptionItem({
      id: "si_pro_new",
      priceId: STRIPE_PRICE_IDS.pro,
      created: 2_000,
    });

    const subscription = createSubscription({
      items: {
        object: "list",
        data: [plusItem, proItem],
        has_more: false,
        url: "/v1/subscriptions/sub_123/items",
      },
    });

    const resolution = resolveSubscriptionPlanCandidate(subscription);
    expect(resolution.plan).toBe("pro");
  });

  it("falls back to metadata when price ids are unknown", () => {
    const item = createSubscriptionItem({
      id: "si_custom",
      priceId: "price_unknown",
      created: 1_000,
    });

    const subscription = createSubscription({
      items: {
        object: "list",
        data: [item],
        has_more: false,
        url: "/v1/subscriptions/sub_123/items",
      },
      metadata: { plan: "plus" },
    });

    const resolution = resolveSubscriptionPlanCandidate(subscription);
    expect(resolution.plan).toBe("plus");
    expect(resolution.source).toBe("metadata");
  });

  it("reads price metadata when ids do not map", () => {
    const item = createSubscriptionItem({
      id: "si_custom",
      priceId: "price_unknown",
      created: 1_000,
      priceMetadata: { plan: "pro" },
    });

    const subscription = createSubscription({
      items: {
        object: "list",
        data: [item],
        has_more: false,
        url: "/v1/subscriptions/sub_123/items",
      },
    });

    const resolution = resolveSubscriptionPlanCandidate(subscription);
    expect(resolution.plan).toBe("pro");
  });
});

describe("resolveProfilePlan", () => {
  it("treats key in-progress statuses as active", () => {
    expect(resolveProfilePlan("incomplete", "plus")).toBe("plus");
    expect(resolveProfilePlan("unpaid", "pro")).toBe("pro");
    expect(isActiveStripeStatus("incomplete")).toBe(true);
  });

  it("returns free when the subscription is canceled or ended", () => {
    expect(resolveProfilePlan("canceled", "pro")).toBe("free");
    expect(resolveProfilePlan("active", "plus", { endedAt: Date.now() / 1000 })).toBe("free");
  });

  it("keeps plan during cancel_at_period_end", () => {
    expect(resolveProfilePlan("active", "pro", { cancelAtPeriodEnd: true })).toBe("pro");
  });
});
