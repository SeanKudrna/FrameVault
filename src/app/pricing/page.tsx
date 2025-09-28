/**
 * Dedicated pricing page that expands on FrameVault's plan matrix, upgrade
 * flows, and frequently asked questions.
 */

import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PricingFeature {
  label: string;
  free: string | boolean;
  plus: string | boolean;
  pro: string | boolean;
}

const pricingTable: PricingFeature[] = [
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

const planDetails = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    description: "Five collections, core editor, public sharing, and status logging.",
  },
  {
    name: "Plus",
    price: "$4.99",
    cadence: "per month",
    description: "Unlimited shelves, custom covers, themes, and data export.",
    featured: true,
  },
  {
    name: "Pro",
    price: "$9.99",
    cadence: "per month",
    description: "Built for film clubs: collaboration, analytics, and smart recs soon.",
  },
];

const faqs = [
  {
    question: "How do upgrades work?",
    answer:
      "Choose Plus or Pro in-app and checkout with Stripe. Plans activate instantly, and you can manage billing in the customer portal anytime.",
  },
  {
    question: "Can I stay on the free plan?",
    answer:
      "Absolutely. Free includes five collections, public pages, and watch logging. Upgrade only when you need more shelves or customization.",
  },
  {
    question: "Do you support teams?",
    answer:
      "Pro is built for teams and film clubs. Collaboration tools are rolling out soon – reach out if you want early access.",
  },
];

function renderCell(value: PricingFeature["free"]) {
  if (typeof value === "boolean") {
    return value ? <Check className="h-5 w-5 text-indigo-300" /> : <Minus className="h-5 w-5 text-slate-600" />;
  }
  return <span className="block text-sm text-slate-200 text-center">{value}</span>;
}

export default function PricingPage() {
  return (
    <main className="relative min-h-screen bg-slate-950">
      <Link
        href="/"
        className="absolute left-6 top-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 hover:text-white"
      >
        <span aria-hidden="true">&lt;</span>
        <span>Back to home</span>
      </Link>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-24 px-6 pb-24 pt-28">
        <header className="space-y-6 text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-indigo-200">Pricing</p>
          <h1 className="text-balance text-4xl font-semibold md:text-5xl">Plans that scale with your cinematic universe</h1>
          <p className="mx-auto max-w-2xl text-sm text-slate-300">
            Start with five collections on Free. Upgrade to Plus for unlimited shelves, cover uploads, and export tools. Pro adds collaboration and advanced insights.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-3">
          {planDetails.map((plan) => (
            <article
              key={plan.name}
              className={`flex h-full flex-col justify-between gap-6 rounded-3xl border border-slate-800/70 bg-slate-950/70 p-8 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.9)] ${
                plan.featured ? "border-indigo-500/60 bg-slate-950" : ""
              }`}
            >
              <div className="space-y-3 text-left">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{plan.name}</p>
                <div className="flex items-baseline gap-2 text-slate-100">
                  <span className="text-4xl font-semibold">{plan.price}</span>
                  <span className="text-sm text-slate-500">{plan.cadence}</span>
                </div>
                <p className="text-sm text-slate-300">{plan.description}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="space-y-6 rounded-3xl border border-slate-800/70 bg-slate-950/70 p-10">
          <h2 className="text-2xl font-semibold text-slate-100">Feature comparison</h2>
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
                {pricingTable.map((row) => (
                  <tr key={row.label} className="text-sm">
                    <td className="py-4 pr-6 text-slate-200">{row.label}</td>
                    <td className="py-4 pr-6">
                      <div className="flex items-center justify-center">{renderCell(row.free)}</div>
                    </td>
                    <td className="py-4 pr-6">
                      <div className="flex items-center justify-center">{renderCell(row.plus)}</div>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center justify-center">{renderCell(row.pro)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-8 md:grid-cols-[2fr_1fr] md:items-center">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-100">Ready to upgrade?</h2>
            <p className="text-sm text-slate-300">
              Upgrades happen inside the app using Stripe Checkout. Once you subscribe, your plan updates automatically within seconds and unlocks Plus features across your account.
            </p>
            <Link
              href="/auth/sign-in"
              className="inline-flex h-14 px-8 text-base font-semibold items-center justify-center gap-2 rounded-xl font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/50 relative overflow-hidden bg-gradient-to-r from-accent-primary via-accent-secondary to-accent-tertiary text-white hover:!text-[#0a0a0f] shadow-[0_4px_20px_rgba(139,92,246,0.3)] hover:shadow-[0_8px_32px_rgba(139,92,246,0.4)] hover:scale-105 active:scale-95 before:absolute before:inset-0 before:bg-white/10 before:opacity-0 hover:before:opacity-100 before:transition-opacity"
            >
              Sign in
            </Link>
          </div>
          <div className="rounded-3xl border border-slate-800/70 bg-slate-950/70 p-6 text-sm text-slate-300">
            <p className="font-medium text-slate-100">Need enterprise or annual billing?</p>
            <p className="mt-2 text-slate-400">Email hello@framevault.app and we&apos;ll tailor a plan for your studio or team.</p>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-center text-2xl font-semibold text-slate-100">Questions, answered</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {faqs.map((faq) => (
              <article
                key={faq.question}
                className="space-y-3 rounded-3xl border border-slate-800/70 bg-slate-950/70 p-6"
              >
                <h3 className="text-base font-semibold text-slate-100">{faq.question}</h3>
                <p className="text-sm text-slate-300">{faq.answer}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
