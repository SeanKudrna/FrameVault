import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import {
  STRIPE_PRICE_IDS,
  isActiveStripeStatus,
  resolvePendingSubscriptionPlan,
  resolveProfilePlan,
  resolveSubscriptionPlanCandidate,
  resolveSubscriptionPlanIncludingFree,
} from "@/lib/billing";

function createSubscriptionItem(options: {
  id: string;
  priceId: string;
  created: number;
  quantity?: number;
  priceMetadata?: Stripe.Metadata;
  itemMetadata?: Stripe.Metadata;
  priceProductMetadata?: Stripe.Metadata;
}): Stripe.SubscriptionItem {
  const { id, priceId, created, quantity = 1, priceMetadata, itemMetadata, priceProductMetadata } = options;
  const product = priceProductMetadata
    ? ({
        id: `prod_${id}`,
        object: "product",
        active: true,
        attributes: [],
        created,
        default_price: null,
        description: null,
        images: [],
        livemode: false,
        metadata: priceProductMetadata,
        name: "Test Product",
        package_dimensions: null,
        shippable: null,
        statement_descriptor: null,
        type: "service",
        unit_label: null,
        updated: created,
        url: null,
      } satisfies Stripe.Product)
    : "prod_123";
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
      product,
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

function createSchedulePhase(options: {
  start: number;
  end: number | null;
  priceId?: string;
  priceMetadata?: Stripe.Metadata;
  metadata?: Stripe.Metadata;
}): Stripe.SubscriptionSchedulePhase {
  const { start, end, priceId, priceMetadata, metadata } = options;
  return {
    start_date: start,
    end_date: end,
    billing_cycle_anchor: null,
    currency: "usd",
    metadata: metadata ?? {},
    proration_behavior: "create_prorations",
    collection_method: "charge_automatically",
    default_payment_method: null,
    default_tax_rates: [],
    invoice_settings: { issuer: null },
    transfer_data: null,
    iterations: null,
    anchors: null,
    items: [
      {
        price: priceId ?? undefined,
        price_data: priceId
          ? undefined
          : {
              currency: "usd",
              product: "prod_schedule",
              recurring: { interval: "month", interval_count: 1 },
              tax_behavior: "unspecified",
              unit_amount: 0,
              unit_amount_decimal: "0",
              metadata: priceMetadata ?? {},
            },
        metadata: {},
        quantity: 1,
        tax_rates: [],
      },
    ],
  } as Stripe.SubscriptionSchedulePhase;
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

  it("reads product metadata when price metadata is missing", () => {
    const item = createSubscriptionItem({
      id: "si_product_meta",
      priceId: "price_unknown",
      created: 4_000,
      priceProductMetadata: { plan: "plus" },
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
    expect(resolution.plan).toBe("plus");
    expect(resolution.source).toBe("price");
  });
});

describe("resolveSubscriptionPlanIncludingFree", () => {
  it("returns free when the active item price is zero", () => {
    const freeItem = createSubscriptionItem({
      id: "si_free",
      priceId: "price_free_tier",
      created: 5_000,
    });

    const subscription = createSubscription({
      items: {
        object: "list",
        data: [freeItem],
        has_more: false,
        url: "/v1/subscriptions/sub_123/items",
      },
    });

    expect(resolveSubscriptionPlanIncludingFree(subscription)).toBe("free");
  });

  it("keeps a free plan when the schedule still references a paid phase", () => {
    const now = Math.floor(Date.now() / 1000);

    const schedule = {
      id: "sub_sched_free_current",
      object: "subscription_schedule",
      canceled_at: null,
      completed_at: null,
      created: now - 20,
      current_phase: { start_date: now - 10, end_date: now + 5 },
      customer: "cus_123",
      default_settings: {
        billing_cycle_anchor: "automatic",
        billing_thresholds: null,
        collection_method: "charge_automatically",
        description: null,
        invoice_settings: { issuer: null },
        transfer_data: null,
      },
      end_behavior: "release",
      livemode: false,
      metadata: {},
      phases: [
        createSchedulePhase({ start: now - 10, end: now + 5, priceId: STRIPE_PRICE_IDS.pro }),
      ],
      released_at: null,
      released_subscription: null,
      renewal_behavior: "release",
      renewal_interval: null,
      status: "active",
      subscription: "sub_123",
      test_clock: null,
    } as Stripe.SubscriptionSchedule;

    const freeItem = createSubscriptionItem({
      id: "si_free_with_schedule",
      priceId: "price_free_schedule_tier",
      created: now - 1,
    });

    const subscription = createSubscription({
      items: {
        object: "list",
        data: [freeItem],
        has_more: false,
        url: "/v1/subscriptions/sub_123/items",
      },
      schedule,
      metadata: { plan: "pro" },
    });

    expect(resolveSubscriptionPlanIncludingFree(subscription)).toBe("free");
  });

  it("prefers recognised paid prices when present", () => {
    const proItem = createSubscriptionItem({
      id: "si_pro_plan",
      priceId: STRIPE_PRICE_IDS.pro,
      created: 6_000,
    });

    const subscription = createSubscription({
      items: {
        object: "list",
        data: [proItem],
        has_more: false,
        url: "/v1/subscriptions/sub_123/items",
      },
    });

    expect(resolveSubscriptionPlanIncludingFree(subscription)).toBe("pro");
  });

  it("prefers the current schedule phase when subscription items already reflect a scheduled downgrade", () => {
    const now = Math.floor(Date.now() / 1000);

    const schedule = {
      id: "sub_sched_downgrade",
      object: "subscription_schedule",
      canceled_at: null,
      completed_at: null,
      created: now - 10,
      current_phase: { start_date: now - 10, end_date: now + 5 },
      customer: "cus_123",
      default_settings: {
        billing_cycle_anchor: "automatic",
        billing_thresholds: null,
        collection_method: "charge_automatically",
        description: null,
        invoice_settings: { issuer: null },
        transfer_data: null,
      },
      end_behavior: "release",
      livemode: false,
      metadata: {},
      phases: [
        createSchedulePhase({ start: now - 10, end: now + 5, priceId: STRIPE_PRICE_IDS.pro }),
        createSchedulePhase({ start: now + 5, end: now + 20, priceId: STRIPE_PRICE_IDS.plus }),
      ],
      released_at: null,
      released_subscription: null,
      renewal_behavior: "release",
      renewal_interval: null,
      status: "active",
      subscription: "sub_123",
      test_clock: null,
    } as Stripe.SubscriptionSchedule;

    const plusItem = createSubscriptionItem({
      id: "si_plus_item",
      priceId: STRIPE_PRICE_IDS.plus,
      created: now - 5,
    });

    const subscription = createSubscription({
      items: {
        object: "list",
        data: [plusItem],
        has_more: false,
        url: "/v1/subscriptions/sub_123/items",
      },
      schedule,
    });

    expect(resolveSubscriptionPlanIncludingFree(subscription)).toBe("pro");
    expect(resolvePendingSubscriptionPlan(subscription)).toBe("plus");
  });
});

describe("resolvePendingSubscriptionPlan", () => {
  it("reads the target plan from pending update items", () => {
    const currentItem = createSubscriptionItem({
      id: "si_current",
      priceId: STRIPE_PRICE_IDS.pro,
      created: 2_000,
    });
    const pendingItem = createSubscriptionItem({
      id: "si_pending",
      priceId: STRIPE_PRICE_IDS.plus,
      created: 3_000,
    });

    const subscription = createSubscription({
      items: {
        object: "list",
        data: [currentItem],
        has_more: false,
        url: "/v1/subscriptions/sub_123/items",
      },
      pending_update: {
        billing_cycle_anchor: null,
        expires_at: null,
        subscription_items: {
          object: "list",
          data: [pendingItem],
          has_more: false,
          url: "/v1/subscriptions/sub_123/items",
        },
        trial_end: null,
        trial_from_plan: false,
        trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
        metadata: {},
        invoice_settings: { issuer: null },
        schedule: null,
      } as Stripe.SubscriptionPendingUpdate,
    });

    expect(resolvePendingSubscriptionPlan(subscription)).toBe("plus");
  });

  it("treats zero-amount pending items as a downgrade to free", () => {
    const currentItem = createSubscriptionItem({
      id: "si_current_pro",
      priceId: STRIPE_PRICE_IDS.pro,
      created: 2_000,
    });
    const pendingFreeItem = createSubscriptionItem({
      id: "si_pending_free",
      priceId: "price_pending_free",
      created: 3_100,
    });

    const subscription = createSubscription({
      items: {
        object: "list",
        data: [currentItem],
        has_more: false,
        url: "/v1/subscriptions/sub_123/items",
      },
      pending_update: {
        billing_cycle_anchor: null,
        expires_at: null,
        subscription_items: {
          object: "list",
          data: [pendingFreeItem],
          has_more: false,
          url: "/v1/subscriptions/sub_123/items",
        },
        trial_end: null,
        trial_from_plan: false,
        trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
        metadata: {},
        invoice_settings: { issuer: null },
        schedule: null,
      } as Stripe.SubscriptionPendingUpdate,
    });

    expect(resolvePendingSubscriptionPlan(subscription)).toBe("free");
  });

  it("falls back to metadata when pending items are missing", () => {
    const subscription = createSubscription({
      pending_update: {
        billing_cycle_anchor: null,
        expires_at: null,
        subscription_items: {
          object: "list",
          data: [],
          has_more: false,
          url: "/v1/subscriptions/sub_123/items",
        },
        trial_end: null,
        trial_from_plan: false,
        trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
        metadata: { plan: "pro" },
        invoice_settings: { issuer: null },
        schedule: null,
      } as Stripe.SubscriptionPendingUpdate,
    });

    expect(resolvePendingSubscriptionPlan(subscription)).toBe("pro");
  });

  it("returns the scheduled downgrade plan when provided via subscription.schedule", () => {
    const now = Math.floor(Date.now() / 1000);
    const schedule = {
      id: "sub_sched_123",
      object: "subscription_schedule",
      canceled_at: null,
      completed_at: null,
      created: now - 10,
      current_phase: { start_date: now - 10, end_date: now + 5 },
      customer: "cus_123",
      default_settings: {
        billing_cycle_anchor: "automatic",
        billing_thresholds: null,
        collection_method: "charge_automatically",
        description: null,
        invoice_settings: { issuer: null },
        transfer_data: null,
      },
      end_behavior: "release",
      livemode: false,
      metadata: {},
      phases: [
        createSchedulePhase({ start: now - 10, end: now + 5, priceId: STRIPE_PRICE_IDS.pro }),
        createSchedulePhase({ start: now + 5, end: now + 20, priceId: STRIPE_PRICE_IDS.plus }),
      ],
      released_at: null,
      released_subscription: null,
      renewal_behavior: "release",
      renewal_interval: null,
      status: "active",
      subscription: "sub_123",
      test_clock: null,
    } as Stripe.SubscriptionSchedule;

    const proItem = createSubscriptionItem({
      id: "si_pro_current",
      priceId: STRIPE_PRICE_IDS.pro,
      created: now - 20,
    });

    const subscription = createSubscription({
      items: {
        object: "list",
        data: [proItem],
        has_more: false,
        url: "/v1/subscriptions/sub_123/items",
      },
      schedule,
    });

    expect(resolvePendingSubscriptionPlan(subscription)).toBe("plus");
  });

  it("treats zero-amount schedule items as a downgrade to free", () => {
    const now = Math.floor(Date.now() / 1000);
    const schedule = {
      id: "sub_sched_free",
      object: "subscription_schedule",
      canceled_at: null,
      completed_at: null,
      created: now - 10,
      current_phase: { start_date: now - 10, end_date: now + 5 },
      customer: "cus_123",
      default_settings: {
        billing_cycle_anchor: "automatic",
        billing_thresholds: null,
        collection_method: "charge_automatically",
        description: null,
        invoice_settings: { issuer: null },
        transfer_data: null,
      },
      end_behavior: "release",
      livemode: false,
      metadata: {},
      phases: [
        createSchedulePhase({ start: now - 10, end: now + 5, priceId: STRIPE_PRICE_IDS.plus }),
        createSchedulePhase({ start: now + 5, end: now + 20, priceId: undefined, priceMetadata: { plan: "free" } }),
      ],
      released_at: null,
      released_subscription: null,
      renewal_behavior: "release",
      renewal_interval: null,
      status: "active",
      subscription: "sub_123",
      test_clock: null,
    } as Stripe.SubscriptionSchedule;

    const plusItem = createSubscriptionItem({
      id: "si_plus_current",
      priceId: STRIPE_PRICE_IDS.plus,
      created: now - 20,
    });

    const subscription = createSubscription({
      items: {
        object: "list",
        data: [plusItem],
        has_more: false,
        url: "/v1/subscriptions/sub_123/items",
      },
      schedule,
    });

    expect(resolvePendingSubscriptionPlan(subscription)).toBe("free");
  });

  it("returns null when the pending plan matches the current plan", () => {
    const proItem = createSubscriptionItem({
      id: "si_pro",
      priceId: STRIPE_PRICE_IDS.pro,
      created: 1_000,
    });

    const subscription = createSubscription({
      items: {
        object: "list",
        data: [proItem],
        has_more: false,
        url: "/v1/subscriptions/sub_123/items",
      },
      pending_update: {
        billing_cycle_anchor: null,
        expires_at: null,
        subscription_items: {
          object: "list",
          data: [proItem],
          has_more: false,
          url: "/v1/subscriptions/sub_123/items",
        },
        trial_end: null,
        trial_from_plan: false,
        trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
        metadata: {},
        invoice_settings: { issuer: null },
        schedule: null,
      } as Stripe.SubscriptionPendingUpdate,
    });

    expect(resolvePendingSubscriptionPlan(subscription)).toBeNull();
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
