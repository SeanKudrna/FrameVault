"use client";

/**
 * Billing settings surface that lets members upgrade, access the Stripe portal,
 * and review their current subscription status. Fetching happens on the server
 * route so this component focuses purely on interactions.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, CreditCard, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/toast-provider";
import type { Plan, Profile } from "@/lib/supabase/types";
import type { PaidPlan } from "@/lib/billing";

interface SubscriptionSnapshot {
  plan: Plan;
  status: string;
  current_period_end: string | null;
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

export function BillingSettings({ profile, subscription, checkoutStatus }: BillingSettingsProps) {
  const { toast } = useToast();
  const [loadingPlan, setLoadingPlan] = useState<PaidPlan | "portal" | null>(null);

  const periodEnd = useMemo(() => formatPeriod(subscription?.current_period_end ?? null), [
    subscription?.current_period_end,
  ]);

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
              Status: <span className="font-medium text-slate-200">{subscription?.status ?? "no subscription"}</span>
              {periodEnd ? ` • Renews ${periodEnd}` : null}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
            {profile.plan !== "free" ? (
              <Button
                onClick={handlePortal}
                disabled={loadingPlan !== null}
                variant="muted"
                className="min-w-[160px]"
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

      <section className="grid gap-6 md:grid-cols-2">
        <article className="space-y-3 rounded-3xl border border-slate-800/70 bg-slate-950/60 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Plus highlights</p>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>Unlimited collections and dashboards</li>
            <li>Custom cover uploads and theme accents</li>
            <li>CSV and JSON export for personal backups</li>
          </ul>
          {profile.plan === "free" ? (
            <Button
              variant="muted"
              onClick={() => handleCheckout("plus")}
              disabled={loadingPlan !== null}
              className="mt-4"
            >
              Unlock Plus
              <ArrowRight size={16} className="opacity-80" />
            </Button>
          ) : null}
        </article>
        <article className="space-y-3 rounded-3xl border border-slate-800/70 bg-slate-950/60 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Pro roadmap</p>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>Collaborative collections for film clubs</li>
            <li>Smart recommendations and streaming availability</li>
            <li>Audience analytics to understand engagement</li>
          </ul>
          {profile.plan !== "pro" ? (
            <Button
              variant="muted"
              onClick={() => handleCheckout("pro")}
              disabled={loadingPlan !== null}
              className="mt-4"
            >
              Go Pro early
              <ArrowRight size={16} className="opacity-80" />
            </Button>
          ) : (
            <div className="mt-4 inline-flex items-center gap-2 text-sm text-indigo-300">
              <ShieldCheck size={16} />
              You already have every perk we offer.
            </div>
          )}
        </article>
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
