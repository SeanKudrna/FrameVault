import { ArrowRight, Clapperboard, Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const highlights = [
  "Create cinematic collections in minutes",
  "Drag-and-drop sequencing with instant sync",
  "Public pages to share your curation",
];

export default function LandingPage() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden">
      <div className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.45),_transparent_70%)]" />
      <div className="absolute inset-y-0 right-0 -z-10 hidden w-[480px] bg-[radial-gradient(circle_at_center,_rgba(14,116,144,0.25),_transparent_70%)] md:block" />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-24 px-6 pb-24 pt-28 md:pt-32">
        <header className="flex flex-col gap-6 text-center md:text-left">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-4 py-1 text-xs font-medium uppercase tracking-[0.2em] text-indigo-200">
            <Sparkles size={14} />
            Day One Foundation
          </span>
          <h1 className="max-w-3xl text-balance text-4xl leading-tight md:text-6xl">
            Curate the films that define you, then share the story behind every frame.
          </h1>
          <p className="max-w-2xl text-balance text-base text-slate-300 md:text-lg">
            FrameVault is the quickest way to build and showcase themed movie collections. Search TMDB from inside the app, add notes, and publish beautiful public pages with a single link.
          </p>
          <div className="flex flex-col gap-3 text-sm text-slate-400 md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-200">
                <Clapperboard size={20} />
              </div>
              <span>Supabase Auth + TMDB proxy + Collections editor</span>
            </div>
            <span className="hidden md:block">•</span>
            <span>Free tier includes 5 collections. Upgrade when you&apos;re ready.</span>
          </div>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/app">
                Launch the app
                <ArrowRight size={18} className="opacity-80" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="border border-slate-700/60">
              <Link href="#tour">Explore the product tour</Link>
            </Button>
          </div>
        </header>

        <section
          id="tour"
          className="rounded-3xl border border-slate-800/70 bg-slate-900/70 p-8 shadow-[0_40px_120px_-60px_rgba(15,23,42,0.9)] backdrop-blur"
        >
          <div className="grid gap-10 md:grid-cols-2">
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">What ships today</h2>
              <p className="text-sm leading-relaxed text-slate-300">
                Authenticated collections management with Supabase-backed persistence, TMDB-powered movie search, and read-only public collection pages.
              </p>
              <ul className="space-y-3 text-sm text-slate-300">
                {highlights.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-indigo-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-indigo-500/20 via-transparent to-cyan-500/10 blur-3xl" />
              <div className="w-full max-w-[360px] rounded-2xl border border-slate-800/80 bg-slate-950/80 p-5 shadow-lg">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Quick Peek</p>
                <div className="mt-4 space-y-3 text-sm text-slate-200">
                  <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-3">
                    <p className="font-medium">Collections Dashboard</p>
                    <p className="text-xs text-slate-400">Create, rename, reorder, and publish curated lists.</p>
                  </div>
                  <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-3">
                    <p className="font-medium">TMDB Search Modal</p>
                    <p className="text-xs text-slate-400">Find titles with fully proxied server APIs and caching.</p>
                  </div>
                  <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-3">
                    <p className="font-medium">Public Showcase</p>
                    <p className="text-xs text-slate-400">Share <span className="text-indigo-300">framevault.app/c/username/slug</span> with anyone.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
