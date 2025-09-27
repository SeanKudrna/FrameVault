/**
 * Public marketing landing page for FrameVault. Day 2 introduces polished
 * storytelling, pricing positioning, and smoother navigation into the
 * authenticated app.
 */

import Link from "next/link";
import { ArrowRight, Clapperboard, Star, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Copy blocks for the landing page feature highlights.
 */
const featureSections = [
  {
    eyebrow: "Collections that feel editorial",
    title: "Theme every shelf",
    description:
      "Craft personal film essays with titles, descriptions, and curator notes that explain why each movie matters.",
    bullets: [
      "Unlimited collections on Plus and Pro",
      "Drag-and-drop ordering with instant sync",
      "Duplicate and remix when inspiration strikes",
    ],
  },
  {
    eyebrow: "Sourcing that keeps flowing",
    title: "Search TMDB without leaving",
    description:
      "Pull in artwork, credits, and metadata through our Supabase-backed TMDB proxy. Everything stays cached for fast reloads.",
    bullets: [
      "Advanced rate limiting protects your API keys",
      "Poster fallbacks so every grid stays polished",
      "Instant previews while you browse",
    ],
  },
  {
    eyebrow: "Pages for sharing taste",
    title: "Publish public showcases",
    description:
      "Turn your curations into responsive, SEO-friendly pages with a single toggle. Share anywhere and update in real time.",
    bullets: [
      "Custom covers and themes for Plus members",
      "Readable on every device from day one",
      "Timeline logging keeps friends in the loop",
    ],
  },
];

/**
 * Snapshot view of pricing tiers used both on the homepage and standalone pricing page.
 */
const pricingSnapshot = [
  {
    name: "Free",
    price: "$0",
    highlight: "5 collections, forever",
  },
  {
    name: "Plus",
    price: "$4.99",
    highlight: "Unlimited shelves + customization",
  },
  {
    name: "Pro",
    price: "$9.99",
    highlight: "For collaborators and power users",
  },
];

/**
 * Public marketing page introducing FrameVault and linking to the app and pricing.
 */
export default function LandingPage() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden">
      <div className="absolute inset-x-0 top-[-320px] -z-10 h-[640px] bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.32),_transparent_70%)]" />
      <div className="absolute inset-y-0 right-0 -z-10 hidden w-[520px] bg-[radial-gradient(circle_at_center,_rgba(14,116,144,0.25),_transparent_70%)] md:block" />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-24 px-6 pb-24 pt-16 md:pt-20">
        <header className="flex items-center justify-between gap-6">
          <Link href="/" className="text-lg font-semibold tracking-tight text-slate-100">
            FrameVault
          </Link>
          <nav className="flex items-center gap-4 text-sm text-slate-300">
            <Link href="/pricing" className="transition hover:text-slate-100">
              Pricing
            </Link>
            <Link href="/app" className="transition hover:text-slate-100">
              App
            </Link>
            <Button asChild size="sm">
              <Link href="/auth/sign-in">Sign in</Link>
            </Button>
          </nav>
        </header>

        <section className="grid gap-12 md:grid-cols-[3fr_2fr] md:items-center">
          <div className="space-y-6">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-4 py-1 text-xs font-medium uppercase tracking-[0.22em] text-indigo-200">
              <Wand2 size={16} />
              Day Two — Experience & Billing
            </span>
            <h1 className="max-w-3xl text-balance text-4xl leading-tight md:text-6xl">
              Your movie taste, beautifully curated. Build themed collections, share your shelves, and discover films through friends.
            </h1>
            <p className="max-w-2xl text-pretty text-base text-slate-300 md:text-lg">
              FrameVault pairs a cinematic editor with subscription-ready billing so you can start free, upgrade when you want unlimited shelves, and invite others into your film universe.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/app">
                  Start free
                  <ArrowRight size={18} className="opacity-80" />
                </Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="border border-slate-700/60">
                <Link href="/pricing">See plans</Link>
              </Button>
            </div>
            <div className="flex flex-col gap-3 text-sm text-slate-400 md:flex-row md:items-center">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-200">
                  <Clapperboard size={20} />
                </div>
                <span>TMDB-powered metadata, Supabase auth, Stripe billing, and public sharing.</span>
              </div>
              <span className="hidden md:block">•</span>
              <span>Upgrade to Plus for unlimited collections and custom covers.</span>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-3xl border border-slate-800/70 bg-slate-950/70 p-6 shadow-[0_40px_120px_-70px_rgba(15,23,42,0.95)]">
            <div className="absolute inset-0 -z-10 bg-gradient-to-br from-indigo-500/20 via-transparent to-cyan-500/10" />
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">What&apos;s new</p>
            <ul className="mt-4 space-y-4 text-sm text-slate-200">
              <li className="flex items-start gap-3">
                <Star size={18} className="mt-1 text-indigo-300" />
                <span>Stripe-powered upgrades with instant plan sync and a customer portal.</span>
              </li>
              <li className="flex items-start gap-3">
                <Star size={18} className="mt-1 text-indigo-300" />
                <span>Movie status logging (Watched, Watching, Want) with a personal history feed.</span>
              </li>
              <li className="flex items-start gap-3">
                <Star size={18} className="mt-1 text-indigo-300" />
                <span>Plus customization: cover uploads, themes, exports, and unlimited shelves.</span>
              </li>
            </ul>
          </div>
        </section>

        <section className="space-y-10">
          <header className="space-y-2 text-center">
            <p className="text-xs uppercase tracking-[0.24em] text-indigo-200">Product tour</p>
            <h2 className="text-3xl font-semibold">Delightful from curation to sharing</h2>
            <p className="mx-auto max-w-2xl text-sm text-slate-400">
              FrameVault keeps every step cohesive: discover films, assemble collections, publish to the web, and manage upgrades without leaving the experience.
            </p>
          </header>
          <div className="grid gap-8 md:grid-cols-3">
            {featureSections.map((section) => (
              <article
                key={section.title}
                className="space-y-4 rounded-3xl border border-slate-800/70 bg-slate-950/70 p-8 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.9)]"
              >
                <p className="text-xs uppercase tracking-[0.24em] text-indigo-200">{section.eyebrow}</p>
                <h3 className="text-xl font-semibold text-slate-100">{section.title}</h3>
                <p className="text-sm text-slate-300">{section.description}</p>
                <ul className="space-y-2 text-sm text-slate-300">
                  {section.bullets.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-indigo-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section
          className="rounded-3xl border border-slate-800/70 bg-gradient-to-br from-slate-950/90 via-slate-950 to-slate-900/80 p-10 shadow-[0_40px_120px_-70px_rgba(15,23,42,0.95)]"
        >
          <div className="mb-8 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-indigo-200">Pricing</p>
              <h2 className="mt-2 text-3xl font-semibold text-slate-100">Choose the plan that matches your taste</h2>
              <p className="mt-2 max-w-xl text-sm text-slate-400">
                Start free with five collections. Unlock unlimited shelves, custom covers, exports, and upcoming collaboration perks with Plus and Pro.
              </p>
            </div>
            <Button asChild size="lg" variant="muted">
              <Link href="/pricing">Compare plans</Link>
            </Button>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {pricingSnapshot.map((tier) => (
              <div
                key={tier.name}
                className="space-y-3 rounded-2xl border border-slate-800/70 bg-slate-950/80 p-6"
              >
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{tier.name}</p>
                <p className="text-3xl font-semibold text-slate-100">{tier.price}</p>
                <p className="text-sm text-slate-300">{tier.highlight}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
