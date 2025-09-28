"use client";

/**
 * Billing settings surface that lets members upgrade, access the Stripe portal,
 * and review their current subscription status. Fetching happens on the server
 * route so this component focuses purely on interactions.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, CreditCard, Minus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/toast-provider";
import type { Plan, Profile } from "@/lib/supabase/types";
import type { PaidPlan } from "@/lib/billing";

interface SubscriptionSnapshot {
  plan: Plan;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  pending_plan: Plan | null;
  ended_at: string | null;
}

interface BillingSettingsProps {
  profile: Profile;
  subscription: SubscriptionSnapshot | null;
  checkoutStatus?: "success" | "canceled";
}

const planCopy: Record<PaidPlan | "free", { title: string; description: string }> = {
  free: {
    title: "Free",
    description: "Five collections, core editor, public sharing, and watch logging.",
  },
  plus: {
    title: "Plus",
    description: "Unlimited shelves, custom covers, themes, and export tools.",
  },
  pro: {
    title: "Pro",
    description: "Collaboration, analytics, and advanced recommendation tooling (rolling out soon).",
  },
};

function formatPeriod(end: string | null) {
  if (!end) return null;
  const date = new Date(end);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

interface PricingFeature {
  label: string;
  free: string | boolean;
  plus: string | boolean;
  pro: string | boolean;
}

const pricingFeatures: PricingFeature[] = [
  {
    label: "Collections",
    free: "5 collections",
    plus: "Unlimited",
    pro: "Unlimited",
  },
  {
    label: "Custom covers & themes",
    free: false,
    plus: true,
    pro: true,
  },
  {
    label: "Movie status timeline",
    free: true,
    plus: true,
    pro: true,
  },
  {
    label: "CSV & JSON export",
    free: false,
    plus: true,
    pro: true,
  },
  {
    label: "Collaborative collections",
    free: false,
    plus: false,
    pro: "Coming soon",
  },
  {
    label: "Smart recommendations",
    free: false,
    plus: false,
    pro: "Coming soon",
  },
  {
    label: "Streaming availability",
    free: false,
    plus: false,
    pro: "Coming soon",
  },
  {
    label: "Advanced analytics",
    free: false,
    plus: false,
    pro: "Coming soon",
  },
];

const planCards = [
  {
    key: "free" as Plan,
    name: "Free",
    price: "$0",
    cadence: "forever",
    description: planCopy.free.description,
  },
  {
    key: "plus" as Plan,
    name: "Plus",
    price: "$4.99",
    cadence: "per month",
    description: planCopy.plus.description,
    featured: true,
  },
  {
    key: "pro" as Plan,
    name: "Pro",
    price: "$9.99",
    cadence: "per month",
    description: planCopy.pro.description,
  },
];

function renderFeatureCell(value: PricingFeature["free"]) {
  if (typeof value === "boolean") {
    return value ? <Check className="h-5 w-5 text-indigo-300" /> : <Minus className="h-5 w-5 text-slate-600" />;
  }
  return <span className="block text-sm text-slate-200 text-center">{value}</span>;
}

export function BillingSettings({ profile, subscription, checkoutStatus }: BillingSettingsProps) {
  const { toast } = useToast();
  const [loadingPlan, setLoadingPlan] = useState<PaidPlan | "portal" | null>(null);

  const periodEnd = useMemo(() => formatPeriod(subscription?.current_period_end ?? null), [
    subscription?.current_period_end,
  ]);

  const pendingPlan = profile.next_plan ?? subscription?.pending_plan ?? null;
  const scheduledChange = useMemo(() => {
    if (!pendingPlan || !profile.plan_expires_at) return null;
    const title = planCopy[pendingPlan]?.title ?? pendingPlan;
    if (!title) return null;
    const formatted = formatPeriod(profile.plan_expires_at);
    if (!formatted) return null;
    if (pendingPlan === "free") {
      return `Downgrades to Free on ${formatted}`;
    }
    return `Switches to ${title} on ${formatted}`;
  }, [pendingPlan, profile.plan_expires_at]);

  const handleCheckout = useCallback(
    async (plan: PaidPlan) => {
      try {
        setLoadingPlan(plan);
        const response = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan }),
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.message ?? "Unable to start checkout");
        }

        if (!payload?.url) {
          throw new Error("Stripe did not provide a redirect URL");
        }

        window.location.assign(payload.url as string);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to start checkout";
        toast({ title: "Upgrade failed", description: message, variant: "error" });
      } finally {
        setLoadingPlan(null);
      }
    },
    [toast]
  );

  const handlePortal = useCallback(async () => {
    try {
      setLoadingPlan("portal");
      const response = await fetch("/api/billing/portal");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message ?? "Unable to open billing portal");
      }
      if (!payload?.url) {
        throw new Error("Stripe did not provide a portal URL");
      }
      window.location.assign(payload.url as string);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to open billing portal";
      toast({ title: "Portal unavailable", description: message, variant: "error" });
    } finally {
      setLoadingPlan(null);
    }
  }, [toast]);

  const currentPlan = planCopy[profile.plan];
  const statusLabel = subscription?.status ?? "no subscription";

  useEffect(() => {
    if (!checkoutStatus) return;
    if (checkoutStatus === "success") {
      toast({
        title: "Upgrade successful",
        description: "Your plan will unlock within the next few seconds.",
        variant: "success",
      });
    } else if (checkoutStatus === "canceled") {
      toast({
        title: "Checkout canceled",
        description: "No changes were made to your plan.",
        variant: "info",
      });
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("checkoutSuccess");
    url.searchParams.delete("checkoutCanceled");
    window.history.replaceState({}, document.title, url.toString());
  }, [checkoutStatus, toast]);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-800/70 bg-slate-950/70 p-8 shadow-[0_20px_70px_-60px_rgba(15,23,42,0.9)]">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Current plan</p>
            <h2 className="text-2xl font-semibold text-slate-100">{currentPlan.title}</h2>
            <p className="mt-1 max-w-xl text-sm text-slate-300">{currentPlan.description}</p>
            <p className="mt-3 text-xs text-slate-500">
              Status: <span className="font-medium text-slate-200">{statusLabel}</span>
              {scheduledChange ? ` • ${scheduledChange}` : null}
              {!scheduledChange && periodEnd ? ` • Renews ${periodEnd}` : null}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
            {profile.plan !== "free" ? (
              <Button
                onClick={handlePortal}
                disabled={loadingPlan !== null}
                variant="muted"
                className="min-w-[160px] hover:bg-white/10 hover:text-white/90"
              >
                <CreditCard size={18} />
                Manage billing
              </Button>
            ) : null}
            {profile.plan === "free" ? (
              <Button
                onClick={() => handleCheckout("plus")}
                disabled={loadingPlan !== null}
                className="min-w-[160px]"
              >
                Upgrade to Plus
                <ArrowRight size={18} className="opacity-80" />
              </Button>
            ) : null}
            {profile.plan !== "pro" ? (
              <Button
                onClick={() => handleCheckout("pro")}
                disabled={loadingPlan !== null}
                className="min-w-[160px]"
              >
                Upgrade to Pro
                <ArrowRight size={18} className="opacity-80" />
              </Button>
            ) : null}
          </div>
        </header>
      </section>

      <section className="space-y-10">
        <div className="grid gap-6 lg:grid-cols-3">
          {planCards.map((plan) => {
            const isCurrent = profile.plan === plan.key;
            const isFeatured = Boolean(plan.featured);
            const isProCurrent = plan.key === "pro" && isCurrent;

            return (
              <article
                key={plan.key}
                className={`flex h-full flex-col justify-between gap-6 rounded-3xl border border-slate-800/70 bg-slate-950/60 p-8 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] ${
                  isFeatured ? "border-indigo-500/60 bg-slate-950" : ""
                }`}
              >
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{plan.name}</p>
                  <div className="flex items-baseline gap-2 text-slate-100">
                    <span className="text-3xl font-semibold">{plan.price}</span>
                    <span className="text-sm text-slate-500">{plan.cadence}</span>
                  </div>
                  <p className="text-sm text-slate-300">{plan.description}</p>
                  {isProCurrent ? (
                    <div className="inline-flex items-center gap-2 text-sm text-indigo-300">
                      <ShieldCheck size={16} />
                      You already have every perk we offer.
                    </div>
                  ) : null}
                </div>
                <div>
                  {(() => {
                    if (isCurrent) {
                      return (
                        <Button size="lg" variant="muted" disabled className="w-full">
                          Current plan
                        </Button>
                      );
                    }
                    if (plan.key === "free" || (plan.key === "plus" && profile.plan === "pro")) {
                      return (
                        <Button
                          size="lg"
                          variant="muted"
                          onClick={handlePortal}
                          disabled={loadingPlan !== null}
                          className="w-full hover:bg-white/10 hover:text-white/90"
                        >
                          Manage in Stripe
                          <ArrowRight size={18} className="opacity-80" />
                        </Button>
                      );
                    }
                    return (
                      <Button
                        size="lg"
                        variant={isFeatured ? "default" : "muted"}
                        onClick={() => handleCheckout(plan.key as PaidPlan)}
                        disabled={loadingPlan !== null}
                        className={`w-full${plan.key === "pro" ? " hover:bg-white/10 hover:text-white/90" : ""}`}
                      >
                        {plan.key === "plus" ? "Upgrade to Plus" : "Upgrade to Pro"}
                        <ArrowRight size={18} className="opacity-80" />
                      </Button>
                    );
                  })()}
                </div>
              </article>
            );
          })}
        </div>

        <div className="space-y-6 rounded-3xl border border-slate-800/70 bg-slate-950/70 p-8">
          <h2 className="text-xl font-semibold text-slate-100">Feature comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="text-sm text-slate-400">
                  <th className="py-3 pr-6 font-medium">Feature</th>
                  <th className="py-3 pr-6 font-medium text-center">Free</th>
                  <th className="py-3 pr-6 font-medium text-center">Plus</th>
                  <th className="py-3 font-medium text-center">Pro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {pricingFeatures.map((feature) => (
                  <tr key={feature.label} className="text-sm">
                    <td className="py-4 pr-6 text-slate-200">{feature.label}</td>
                    <td className="py-4 pr-6">
                      <div className="flex items-center justify-center">
                        {renderFeatureCell(feature.free)}
                      </div>
                    </td>
                    <td className="py-4 pr-6">
                      <div className="flex items-center justify-center">
                        {renderFeatureCell(feature.plus)}
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center justify-center">
                        {renderFeatureCell(feature.pro)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {profile.plan !== "free" ? (
        <section className="rounded-3xl border border-slate-800/70 bg-slate-950/70 p-6 text-sm text-slate-300">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-100">Data export</p>
              <p className="text-xs text-slate-500">Download CSV or JSON snapshots of every collection and item.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="muted">
                <a href="/api/export.csv">Download CSV</a>
              </Button>
              <Button asChild variant="muted">
                <a href="/api/export.json">Download JSON</a>
              </Button>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-slate-500">Exports are limited to one request per minute.</p>
        </section>
      ) : null}

      {profile.plan !== "free" ? (
        <footer className="flex flex-col gap-3 rounded-3xl border border-slate-800/70 bg-slate-950/60 p-6 text-sm text-slate-300 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-slate-100">Looking for invoices or need to cancel?</p>
            <p className="text-xs text-slate-500">The Stripe customer portal keeps everything in one place.</p>
          </div>
          <Button
            variant="ghost"
            onClick={handlePortal}
            disabled={loadingPlan !== null}
            className="border border-slate-700/60"
          >
            Open portal
          </Button>
        </footer>
      ) : null}
    </div>
  );
}
