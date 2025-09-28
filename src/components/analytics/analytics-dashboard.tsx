"use client";

import { motion } from "framer-motion";
import { Calendar, Film, TrendingUp } from "lucide-react";
import type { AnalyticsOverview } from "@/lib/analytics";
import type { Profile } from "@/lib/supabase/types";

interface AnalyticsDashboardProps {
  overview: AnalyticsOverview;
  profile: Profile;
}

export function AnalyticsDashboard({ overview, profile }: AnalyticsDashboardProps) {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-100">Insights &amp; trends</h1>
        <p className="text-sm text-slate-400">
          Hello, {profile.display_name ?? profile.username}. Here’s how your film taste is evolving this season.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <InsightCard
          title="Top genres"
          icon={Film}
          description="Your most-watched categories"
        >
          <MetricList items={overview.topGenres} emptyCopy="Watch a few more films to unlock genre trends." />
        </InsightCard>
        <InsightCard
          title="Directors"
          icon={TrendingUp}
          description="Filmmakers you gravitate toward"
        >
          <MetricList items={overview.topDirectors} emptyCopy="Log a couple of films to surface director insights." />
        </InsightCard>
        <InsightCard
          title="Actors"
          icon={TrendingUp}
          description="Cast members showing up often"
        >
          <MetricList items={overview.topActors} emptyCopy="Keep curating to reveal recurring performers." />
        </InsightCard>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-3xl border border-slate-800/70 bg-slate-950/70 p-6 shadow-[0_24px_80px_-60px_rgba(15,23,42,0.75)]">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-100">Yearly cadence</h2>
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Watched</span>
          </div>
          <YearlyChart points={overview.yearlyBreakdown} />
        </div>
        <div className="rounded-3xl border border-slate-800/70 bg-slate-950/70 p-6">
          <h2 className="text-xl font-semibold text-slate-100">Average rating</h2>
          <p className="mt-2 text-4xl font-bold text-indigo-200">
            {typeof overview.averageRating === "number" ? overview.averageRating.toFixed(2) : "—"}
          </p>
          <p className="mt-4 text-sm text-slate-400">
            Based on the ratings you’ve added to collection items. Aim for consistency to keep this metric meaningful.
          </p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl border border-slate-800/70 bg-slate-950/70 p-6">
          <h2 className="text-xl font-semibold text-slate-100">Collection highlights</h2>
          <p className="text-sm text-slate-400">Your busiest shelves and their defining genres.</p>
          <div className="mt-4 space-y-3">
            {overview.collectionHighlights.length ? (
              overview.collectionHighlights.map((highlight) => (
                <div
                  key={highlight.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-200">{highlight.title}</p>
                    <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                      {highlight.itemCount} titles{highlight.topGenre ? ` • ${highlight.topGenre}` : ""}
                    </p>
                  </div>
                  <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-100">
                    {highlight.itemCount > 0 ? "Active" : "Seed it"}
                  </span>
                </div>
              ))
            ) : (
              <EmptyState message="Build out a few collections to unlock highlights." />
            )}
          </div>
        </div>
        <div className="rounded-3xl border border-slate-800/70 bg-slate-950/70 p-6">
          <h2 className="text-xl font-semibold text-slate-100">Recent activity</h2>
          <p className="text-sm text-slate-400">Latest curation moments across your shelves.</p>
          <div className="mt-4 space-y-3">
            {overview.recentActivity.length ? (
              overview.recentActivity.slice(0, 8).map((activity) => (
                <div key={`${activity.collectionId}-${activity.tmdbId}-${activity.addedAt}`} className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-indigo-500/40 bg-indigo-500/10 text-indigo-200">
                    <Calendar size={16} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-200">
                      Added TMDB #{activity.tmdbId} to <span className="font-medium">{activity.collectionTitle}</span>
                    </p>
                    <p className="text-xs text-slate-500">{new Date(activity.addedAt).toLocaleString()}</p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState message="Add a few films to see your timeline spark to life." />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

interface InsightCardProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number }>;
  children: React.ReactNode;
}

function InsightCard({ title, description, icon: Icon, children }: InsightCardProps) {
  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-slate-800/70 bg-slate-950/70 p-6 shadow-[0_24px_80px_-60px_rgba(15,23,42,0.75)]">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-200">
          <Icon size={18} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

interface MetricListProps {
  items: { name: string; count: number }[];
  emptyCopy: string;
}

function MetricList({ items, emptyCopy }: MetricListProps) {
  if (!items.length) {
    return <EmptyState message={emptyCopy} />;
  }

  const max = Math.max(...items.map((item) => item.count));

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.name} className="space-y-1">
          <div className="flex items-center justify-between text-sm text-slate-200">
            <span>{item.name}</span>
            <span className="text-xs text-slate-500">{item.count}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800/70">
            <motion.div
              layout
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-indigo-400 to-sky-400"
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

interface YearlyChartProps {
  points: { year: number; count: number }[];
}

function YearlyChart({ points }: YearlyChartProps) {
  if (!points.length) {
    return <EmptyState message="Watched films will populate this chart automatically." />;
  }

  const max = Math.max(...points.map((point) => point.count));

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 text-sm text-slate-200 md:grid-cols-2">
      {points.map((point) => (
        <div key={point.year} className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">{point.year}</span>
            <span className="text-xs text-slate-500">{point.count} watched</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800/70">
            <motion.div
              layout
              className="h-full rounded-full bg-gradient-to-r from-sky-500 via-indigo-500 to-indigo-300"
              style={{ width: `${(point.count / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700/60 bg-slate-900/40 p-6 text-sm text-slate-400">
      {message}
    </div>
  );
}
