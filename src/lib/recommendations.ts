/**
 * Generates "Smart Picks" recommendations for Pro members using a simple
 * content-based heuristic. The module analyses a member's viewing history and
 * owned collections to surface TMDB titles that align with their favourite
 * genres while avoiding duplicates they've already saved or logged.
 */

import { getSupabaseServiceRoleClient } from "@/lib/supabase/service";
import type { MovieSummary } from "@/lib/tmdb";
import { discoverMovies } from "@/lib/tmdb";

interface GenreMetric {
  id: number;
  name: string;
  count: number;
}

export interface TasteProfile {
  sampleSize: number;
  topGenres: GenreMetric[];
}

export interface SmartPick {
  movie: MovieSummary;
  rationale: string[];
}

export interface SmartPickResult {
  profile: TasteProfile;
  picks: SmartPick[];
}

interface SmartPickOptions {
  limit?: number;
  excludeTmdbIds?: number[];
}

function incrementGenre(metric: Map<number, GenreMetric>, genre: { id: number; name: string }) {
  const existing = metric.get(genre.id);
  if (existing) {
    existing.count += 1;
    return;
  }
  metric.set(genre.id, { id: genre.id, name: genre.name || "Unknown", count: 1 });
}

function createRationale(overlap: { id: number; name: string }[], fallbackGenres: GenreMetric[]) {
  if (overlap.length) {
    return overlap
      .slice(0, 2)
      .map((genre) => `Because you love ${genre.name}`);
  }
  if (fallbackGenres.length) {
    return [`Because you’re into ${fallbackGenres[0].name}`];
  }
  return ["Trending with the FrameVault community"];
}

/**
 * Computes personalised movie recommendations using TMDB discover queries.
 */
export async function getSmartPicksForUser(userId: string, options: SmartPickOptions = {}): Promise<SmartPickResult> {
  const limit = Math.max(1, options.limit ?? 12);
  const service = getSupabaseServiceRoleClient();

  const [{ data: viewLogs, error: viewError }, { data: collections, error: collectionsError }] = await Promise.all([
    service
      .from("view_logs")
      .select("tmdb_id, status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(400),
    service
      .from("collections")
      .select("id")
      .eq("owner_id", userId),
  ]);

  if (viewError) throw viewError;
  if (collectionsError) throw collectionsError;

  const excluded = new Set<number>();
  const tasteIds = new Set<number>();

  for (const log of viewLogs ?? []) {
    const tmdbId = Number(log.tmdb_id);
    if (!Number.isFinite(tmdbId)) continue;
    excluded.add(tmdbId);
    if (log.status === "watched") {
      tasteIds.add(tmdbId);
    }
  }

  const collectionIds = (collections ?? []).map((row) => row.id);
  if (collectionIds.length > 0) {
    const { data: items, error: itemsError } = await service
      .from("collection_items")
      .select("tmdb_id")
      .in("collection_id", collectionIds);
    if (itemsError) throw itemsError;
    for (const item of items ?? []) {
      const tmdbId = Number(item.tmdb_id);
      if (!Number.isFinite(tmdbId)) continue;
      excluded.add(tmdbId);
      tasteIds.add(tmdbId);
    }
  }

  for (const id of options.excludeTmdbIds ?? []) {
    excluded.add(id);
  }

  const tastePool = Array.from(tasteIds).slice(0, 200);
  const genreMetrics = new Map<number, GenreMetric>();

  if (tastePool.length > 0) {
    const { data: movies, error: moviesError } = await service
      .from("movies")
      .select("tmdb_id, genres")
      .in("tmdb_id", tastePool);
    if (moviesError) throw moviesError;

    for (const movie of movies ?? []) {
      const genres = Array.isArray(movie.genres) ? (movie.genres as { id: number; name: string }[]) : [];
      for (const genre of genres) {
        if (typeof genre?.id === "number") {
          incrementGenre(genreMetrics, genre);
        }
      }
    }
  }

  const rankedGenres = Array.from(genreMetrics.values()).sort((a, b) => b.count - a.count);
  const focusGenreIds = rankedGenres.slice(0, 3).map((genre) => genre.id);
  const focusGenreSet = new Set(focusGenreIds);

  const picks: SmartPick[] = [];
  const fetchedIds = new Set<number>();
  let page = 1;
  const maxPages = focusGenreIds.length ? 4 : 2;

  while (picks.length < limit && page <= maxPages) {
    const candidates = await discoverMovies({
      withGenres: focusGenreIds.length ? focusGenreIds : undefined,
      page,
      sortBy: focusGenreIds.length ? "popularity.desc" : "vote_average.desc",
      voteAverageGte: focusGenreIds.length ? 6 : 7,
      voteCountGte: focusGenreIds.length ? 150 : 300,
    });

    for (const movie of candidates) {
      if (picks.length >= limit) break;
      if (excluded.has(movie.tmdbId) || fetchedIds.has(movie.tmdbId)) continue;
      fetchedIds.add(movie.tmdbId);

      const overlappingGenres = movie.genres.filter((genre) => focusGenreSet.has(genre.id));
      picks.push({
        movie,
        rationale: createRationale(overlappingGenres, rankedGenres),
      });
    }

    page += 1;
  }

  return {
    profile: {
      sampleSize: tasteIds.size,
      topGenres: rankedGenres.slice(0, 5),
    },
    picks,
  };
}
