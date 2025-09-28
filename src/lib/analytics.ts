/**
 * Aggregates server-side analytics for Pro members. The module favours SQL-lite
 * reductions executed via the Supabase service role client and performs
 * lightweight summarisation in Node so the dashboard can render fast without
 * duplicating data logic across routes.
 */

import { getSupabaseServiceRoleClient } from "@/lib/supabase/service";

interface CountMetric {
  name: string;
  count: number;
}

export interface YearlyCount {
  year: number;
  count: number;
}

export interface CollectionHighlight {
  id: string;
  title: string;
  itemCount: number;
  topGenre: string | null;
}

export interface RecentActivity {
  collectionId: string;
  collectionTitle: string;
  tmdbId: number;
  addedAt: string;
}

export interface AnalyticsOverview {
  topGenres: CountMetric[];
  topDirectors: CountMetric[];
  topActors: CountMetric[];
  yearlyBreakdown: YearlyCount[];
  averageRating: number | null;
  collectionHighlights: CollectionHighlight[];
  recentActivity: RecentActivity[];
}

function toCountMetric(map: Map<string, number>, limit = 10) {
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function safeParseJSON(value: unknown) {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function extractCrewNames(record: Record<string, unknown> | null, role: "director" | "actor") {
  if (!record) return [] as string[];
  const credits = record.credits as Record<string, unknown> | null | undefined;
  if (!credits || typeof credits !== "object") return [] as string[];

  if (role === "director") {
    const crew = Array.isArray(credits.crew) ? (credits.crew as Record<string, unknown>[]) : [];
    return crew
      .filter((member) => (member.job ?? member.department) === "Director" && typeof member.name === "string")
      .map((member) => member.name as string);
  }

  const cast = Array.isArray(credits.cast) ? (credits.cast as Record<string, unknown>[]) : [];
  return cast
    .filter((member) => typeof member.name === "string")
    .slice(0, 10)
    .map((member) => member.name as string);
}

function incrementMetric(map: Map<string, number>, key: string) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + 1);
}

/**
 * Loads aggregated analytics for a member. Falls back gracefully when cached
 * movie metadata is incomplete by simply omitting those data points.
 */
export async function getAnalyticsOverview(userId: string): Promise<AnalyticsOverview> {
  const service = getSupabaseServiceRoleClient();

  const [{ data: viewLogs, error: viewError }, { data: collections, error: collectionsError }] = await Promise.all([
    service
      .from("view_logs")
      .select("tmdb_id, watched_at, created_at")
      .eq("user_id", userId)
      .eq("status", "watched")
      .order("watched_at", { ascending: false })
      .limit(600),
    service
      .from("collections")
      .select("id, title")
      .eq("owner_id", userId),
  ]);

  if (viewError) throw viewError;
  if (collectionsError) throw collectionsError;

  const watchedIds = Array.from(new Set((viewLogs ?? []).map((log) => Number(log.tmdb_id)).filter((id) => Number.isFinite(id)))) as number[];
  const tmdbIdSet = new Set(watchedIds);

  const { data: watchedMovies, error: moviesError } = watchedIds.length
    ? await service
        .from("movies")
        .select("tmdb_id, genres, tmdb_json, release_year")
        .in("tmdb_id", watchedIds)
    : { data: [], error: null };
  if (moviesError) throw moviesError;

  const genreCounts = new Map<string, number>();
  const directorCounts = new Map<string, number>();
  const actorCounts = new Map<string, number>();
  const yearCounts = new Map<number, number>();

  for (const movie of watchedMovies ?? []) {
    const genres = Array.isArray(movie.genres) ? (movie.genres as { id: number; name: string }[]) : [];
    for (const genre of genres) {
      if (genre?.name) {
        incrementMetric(genreCounts, genre.name);
      }
    }

    const tmdbJson = safeParseJSON(movie.tmdb_json ?? null);
    for (const director of extractCrewNames(tmdbJson, "director")) {
      incrementMetric(directorCounts, director);
    }
    for (const actor of extractCrewNames(tmdbJson, "actor")) {
      incrementMetric(actorCounts, actor);
    }

    const releaseYear = typeof movie.release_year === "number" ? movie.release_year : null;
    if (releaseYear) {
      yearCounts.set(releaseYear, (yearCounts.get(releaseYear) ?? 0) + 1);
    }
  }

  const collectionIds = (collections ?? []).map((collection) => collection.id);
  const { data: collectionItems, error: itemsError } = collectionIds.length
    ? await service
        .from("collection_items")
        .select("collection_id, tmdb_id, added_at, rating")
        .in("collection_id", collectionIds)
    : { data: [], error: null };
  if (itemsError) throw itemsError;

  const ratings: number[] = [];
  const collectionGenreMap = new Map<string, Map<string, number>>();
  const collectionCounts = new Map<string, number>();
  const recentActivity: RecentActivity[] = [];

  const byCollection = new Map<string, { title: string }>();
  for (const collection of collections ?? []) {
    byCollection.set(collection.id, { title: collection.title });
  }

  for (const item of collectionItems ?? []) {
    const collectionId = item.collection_id;
    const tmdbId = Number(item.tmdb_id);
    collectionCounts.set(collectionId, (collectionCounts.get(collectionId) ?? 0) + 1);

    if (typeof item.rating === "number") {
      ratings.push(item.rating);
    }

    if (Number.isFinite(tmdbId)) {
      tmdbIdSet.add(tmdbId);
      const movie = watchedMovies?.find((row) => row.tmdb_id === tmdbId);
      const genres = Array.isArray(movie?.genres) ? (movie?.genres as { id: number; name: string }[]) : [];
      if (genres.length) {
        const genreMap = collectionGenreMap.get(collectionId) ?? new Map<string, number>();
        for (const genre of genres) {
          incrementMetric(genreMap, genre.name);
        }
        collectionGenreMap.set(collectionId, genreMap);
      }
    }

    if (item.added_at) {
      recentActivity.push({
        collectionId,
        collectionTitle: byCollection.get(collectionId)?.title ?? "",
        tmdbId,
        addedAt: item.added_at,
      });
    }
  }

  recentActivity.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());

  const collectionHighlights: CollectionHighlight[] = collectionIds.map((id) => {
    const title = byCollection.get(id)?.title ?? "Untitled";
    const itemCount = collectionCounts.get(id) ?? 0;
    const genreMap = collectionGenreMap.get(id) ?? new Map<string, number>();
    const [topGenre] = toCountMetric(genreMap, 1);
    return {
      id,
      title,
      itemCount,
      topGenre: topGenre?.name ?? null,
    };
  });

  collectionHighlights.sort((a, b) => b.itemCount - a.itemCount);

  const averageRating = ratings.length
    ? Number((ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(2))
    : null;

  const yearlyBreakdown = Array.from(yearCounts.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year - b.year);

  return {
    topGenres: toCountMetric(genreCounts, 8),
    topDirectors: toCountMetric(directorCounts, 8),
    topActors: toCountMetric(actorCounts, 8),
    yearlyBreakdown,
    averageRating,
    collectionHighlights: collectionHighlights.slice(0, 8),
    recentActivity: recentActivity.slice(0, 12),
  };
}
