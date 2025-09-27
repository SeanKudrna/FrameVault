/**
 * Server-rendered timeline of a member's viewing activity. Groups statuses by
 * month and surfaces metadata pulled from the cached TMDB table.
 */

import { redirect } from "next/navigation";
import { CalendarDays, CheckCircle2, PlayCircle, BookmarkPlus } from "lucide-react";
import { PosterImage } from "@/components/media/poster-image";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Movie, WatchStatus } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

interface TimelineEntry {
  tmdbId: number;
  status: WatchStatus;
  watchedAt: string | null;
  createdAt: string;
  timestamp: string;
}

const HISTORY_STATUS_CONFIG: Record<WatchStatus, { label: string; pillClass: string; datePrefix: string; Icon: typeof CheckCircle2 }> = {
  watched: {
    label: "Watched",
    pillClass: "border-emerald-500/40 bg-emerald-500/10 text-emerald-100",
    datePrefix: "Watched",
    Icon: CheckCircle2,
  },
  watching: {
    label: "Watching",
    pillClass: "border-sky-500/40 bg-sky-500/10 text-sky-100",
    datePrefix: "Updated",
    Icon: PlayCircle,
  },
  want: {
    label: "Watchlist",
    pillClass: "border-indigo-500/40 bg-indigo-500/10 text-indigo-100",
    datePrefix: "Added",
    Icon: BookmarkPlus,
  },
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export default async function HistoryPage() {
  const supabase = await getSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) throw userError;
  const user = userData?.user;
  if (!user) {
    redirect("/auth/sign-in");
  }

  const logsResponse = await supabase
    .from("view_logs")
    .select("tmdb_id, status, watched_at, created_at")
    .eq("user_id", user.id)
    .limit(300);

  if (logsResponse.error) throw logsResponse.error;

  const logs = (logsResponse.data ?? []).map((log) => ({
    tmdbId: log.tmdb_id,
    status: log.status as WatchStatus,
    watchedAt: log.watched_at,
    createdAt: log.created_at,
    timestamp: log.watched_at ?? log.created_at,
  })) as TimelineEntry[];

  logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const tmdbIds = Array.from(new Set(logs.map((log) => log.tmdbId)));
  const moviesMap = new Map<number, Movie>();
  if (tmdbIds.length > 0) {
    const moviesResponse = await supabase
      .from("movies")
      .select("tmdb_id, title, release_year, poster_url, tmdb_json")
      .in("tmdb_id", tmdbIds);
    if (moviesResponse.error) throw moviesResponse.error;
    for (const movie of moviesResponse.data ?? []) {
      moviesMap.set(movie.tmdb_id, movie as Movie);
    }
  }

  const groups = new Map<string, TimelineEntry[]>();
  for (const entry of logs) {
    const keyDate = new Date(entry.timestamp);
    const key = `${keyDate.getFullYear()}-${String(keyDate.getMonth() + 1).padStart(2, "0")}`;
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }

  const orderedGroups = Array.from(groups.entries())
    .sort(([a], [b]) => (a > b ? -1 : 1))
    .map(([key, entries]) => {
      const [year, month] = key.split("-");
      const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
      });
      return { key, label, entries };
    });

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">History</h1>
        <p className="text-sm text-slate-400">Track when you watched, started, or saved films from your collections.</p>
      </header>

      {logs.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-800/70 bg-slate-950/70 p-12 text-center text-sm text-slate-400">
          Your history is empty. Mark films as watched or add them to your watchlist to see them here.
        </div>
      ) : (
        <div className="space-y-12">
          {orderedGroups.map((group) => (
            <section key={group.key} className="space-y-4">
              <div className="flex items-center gap-2 text-slate-200">
                <CalendarDays size={18} className="text-indigo-200" />
                <h2 className="text-xl font-semibold">{group.label}</h2>
              </div>
              <div className="space-y-4">
                {group.entries.map((entry) => {
                  const movie = moviesMap.get(entry.tmdbId) ?? null;
                  const overview =
                    movie?.tmdb_json && typeof movie.tmdb_json === "object" && "overview" in movie.tmdb_json
                      ? (movie.tmdb_json as Record<string, unknown>)["overview"]
                      : null;
                  const statusMeta = HISTORY_STATUS_CONFIG[entry.status];
                  const dateLabel = `${statusMeta.datePrefix} ${formatDate(entry.watchedAt ?? entry.createdAt)}`;
                  return (
                    <article
                      key={`${entry.tmdbId}-${entry.timestamp}`}
                      className="flex gap-4 rounded-2xl border border-slate-800/70 bg-slate-950/70 p-4 shadow-[0_16px_70px_-60px_rgba(15,23,42,0.9)]"
                    >
                      <div className="relative h-24 w-16 flex-shrink-0 overflow-hidden rounded-xl">
                        <PosterImage
                          src={movie?.poster_url ?? null}
                          fallbackSrc={
                            movie?.tmdb_json && typeof movie.tmdb_json === "object" && "fallbackPosterUrl" in movie.tmdb_json
                              ? ((movie.tmdb_json as Record<string, unknown>)["fallbackPosterUrl"] as string | null)
                              : null
                          }
                          alt={movie?.title ?? "Poster"}
                          sizes="(max-width: 640px) 80px, 120px"
                          tmdbId={movie?.tmdb_id ?? null}
                        />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-base font-semibold text-slate-100">{movie?.title ?? "Untitled"}</p>
                            <p className="text-xs text-slate-500">{dateLabel}</p>
                          </div>
                          <span
                            className={cn(
                              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
                              statusMeta.pillClass
                            )}
                          >
                            <statusMeta.Icon size={16} />
                            {statusMeta.label}
                          </span>
                        </div>
                        {overview ? <p className="text-xs text-slate-400 line-clamp-3">{overview as string}</p> : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
