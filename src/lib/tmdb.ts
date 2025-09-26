import { getServerEnv } from "@/env";
import { apiError } from "@/lib/api";
import { enforceRateLimit, isRateLimitError } from "@/lib/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service";
import type { Movie } from "@/lib/supabase/types";
import { getClientIp } from "@/lib/request";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const env = getServerEnv();

export interface MovieSummary {
  tmdbId: number;
  title: string;
  releaseYear: number | null;
  overview: string | null;
  posterUrl: string | null;
  fallbackPosterUrl?: string | null;
  backdropUrl: string | null;
  genres: { id: number; name: string }[];
  runtime: number | null;
  voteAverage: number | null;
}

interface TMDBMovieResult {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  runtime?: number | null;
  vote_average?: number | null;
  vote_count?: number | null;
  popularity?: number | null;
}

interface TMDBImagesResult {
  posters?: Array<{
    file_path?: string | null;
    vote_count?: number | null;
    vote_average?: number | null;
    iso_639_1?: string | null;
    width?: number | null;
    height?: number | null;
  }>;
}

class TMDBError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function buildImage(path: string | null | undefined, size: "w500" | "w780" | "w1280" = "w500") {
  if (!path) return null;
  return `${env.TMDB_IMAGE_BASE}/${size}${path}`;
}

function mapMovie(payload: TMDBMovieResult): MovieSummary {
  const releaseDate = payload.release_date ?? payload.first_air_date ?? null;
  const releaseYear = releaseDate ? parseInt(releaseDate.slice(0, 4), 10) : null;
  return {
    tmdbId: payload.id,
    title:
      payload.title ?? payload.name ?? payload.original_title ?? "Untitled",
    overview: payload.overview ?? null,
    posterUrl: buildImage(payload.poster_path, "w500"),
    backdropUrl: buildImage(payload.backdrop_path, "w1280"),
    releaseYear: Number.isNaN(releaseYear) ? null : releaseYear,
    genres:
      payload.genres ??
      (payload.genre_ids?.map((id) => ({ id, name: "" })) ?? []),
    runtime: payload.runtime ?? null,
    voteAverage: payload.vote_average ?? null,
  };
}

function mapCachedMovie(row: Movie): MovieSummary {
  let fallbackPosterUrl: string | null = null;
  if (row.tmdb_json && typeof row.tmdb_json === "object" && "fallbackPosterUrl" in row.tmdb_json) {
    const fallback = (row.tmdb_json as Record<string, unknown>)["fallbackPosterUrl"];
    fallbackPosterUrl = typeof fallback === "string" ? fallback : null;
  }
  return {
    tmdbId: row.tmdb_id,
    title: row.title ?? "Untitled",
    overview: row.tmdb_json && typeof row.tmdb_json === "object" && "overview" in row.tmdb_json ? (row.tmdb_json as Record<string, unknown>)["overview"] as string | null : null,
    posterUrl: row.poster_url ?? fallbackPosterUrl,
    fallbackPosterUrl,
    backdropUrl: row.backdrop_url,
    releaseYear: row.release_year ?? null,
    genres: Array.isArray(row.genres)
      ? (row.genres as { id: number; name: string }[])
      : [],
    runtime: row.runtime ?? null,
    voteAverage:
      row.tmdb_json && typeof row.tmdb_json === "object" && "vote_average" in row.tmdb_json
        ? Number((row.tmdb_json as Record<string, unknown>)["vote_average"])
        : null,
  };
}

function normalizeSearchValue(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function tokenizeSearchValue(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function computeSearchScore(result: TMDBMovieResult, query: string) {
  const normalizedQuery = normalizeSearchValue(query);
  const queryTokens = tokenizeSearchValue(query);

  const candidateTitles = [result.title, result.original_title, result.name].filter(
    (value): value is string => Boolean(value)
  );

  let titleScore = 0;

  for (const candidate of candidateTitles) {
    const normalizedTitle = normalizeSearchValue(candidate);
    if (!normalizedTitle) continue;

    if (normalizedTitle === normalizedQuery) {
      titleScore = Math.max(titleScore, 5000);
    } else if (normalizedTitle.startsWith(normalizedQuery)) {
      titleScore = Math.max(titleScore, 4000);
    } else if (normalizedTitle.includes(normalizedQuery)) {
      titleScore = Math.max(titleScore, 3200);
    }

    const tokenizedTitle = tokenizeSearchValue(candidate);
    if (queryTokens.length && tokenizedTitle.length) {
      let matches = 0;
      for (const token of queryTokens) {
        if (token.length <= 2) continue;
        if (tokenizedTitle.some((titleToken) => titleToken === token)) {
          matches += 1;
        } else if (tokenizedTitle.some((titleToken) => titleToken.startsWith(token))) {
          matches += 0.5;
        }
      }
      if (matches) {
        titleScore = Math.max(titleScore, 2800 + matches * 120);
      }
    }
  }

  const popularityScore = (() => {
    const popularity = result.popularity ?? 0;
    return popularity > 0 ? Math.log10(popularity + 1) * 400 : 0;
  })();

  const voteAverageScore = (result.vote_average ?? 0) * 20;
  const voteCountScore = (() => {
    const voteCount = result.vote_count ?? 0;
    return voteCount > 0 ? Math.log10(voteCount + 1) * 120 : 0;
  })();

  let recencyScore = 0;
  const releaseDate = result.release_date ?? result.first_air_date ?? null;
  if (releaseDate) {
    const releaseYear = Number.parseInt(releaseDate.slice(0, 4), 10);
    if (!Number.isNaN(releaseYear)) {
      const currentYear = new Date().getFullYear();
      const age = Math.abs(currentYear - releaseYear);
      recencyScore = Math.max(0, 180 - age * 8);
    }
  }

  return titleScore + popularityScore + voteAverageScore + voteCountScore + recencyScore;
}

async function cacheMovies(movies: MovieSummary[], tmdbPayloads?: Record<number, unknown>) {
  if (!movies.length) return;
  const service = getSupabaseServiceRoleClient();
  const rows = movies.map((movie) => ({
    tmdb_id: movie.tmdbId,
    title: movie.title,
    release_year: movie.releaseYear,
    poster_url: movie.posterUrl,
    backdrop_url: movie.backdropUrl,
    genres: movie.genres,
    runtime: movie.runtime,
    tmdb_json:
      tmdbPayloads?.[movie.tmdbId] ?? {
        overview: movie.overview,
        vote_average: movie.voteAverage,
        fallbackPosterUrl: movie.fallbackPosterUrl ?? null,
      },
  }));

  const { error } = await service
    .from("movies")
    .upsert(rows, { onConflict: "tmdb_id" });
  if (error) throw error;
}

async function tmdbFetch<T>(endpoint: string, params: Record<string, string | number | boolean | undefined> = {}) {
  const url = new URL(`${env.TMDB_API_BASE.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    url.searchParams.set(key, String(value));
  });

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${env.TMDB_V4_READ_TOKEN}`,
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new TMDBError(response.status, message || "TMDB request failed");
  }

  return (await response.json()) as T;
}

export async function handleSearch(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("query")?.trim();
  if (!query || query.length < 2) {
    return apiError("invalid_query", "Search query must be at least 2 characters", 400);
  }

  const supabase = await getSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const ip = getClientIp(request);

  try {
    await enforceRateLimit("search", [
      ...(userData?.user ? [{ actorId: userData.user.id, actorType: "user" as const, limit: 60 }] : []),
      ...(ip ? [{ actorId: ip, actorType: "ip" as const, limit: 120 }] : []),
    ]);
  } catch (error) {
    if (isRateLimitError(error)) {
      return new Response(
        JSON.stringify({ error: error.code, message: error.message }),
        {
          status: error.status,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(error.retryAfter),
          },
        }
      );
    }
    throw error;
  }

  try {
    const data = await tmdbFetch<{ results: TMDBMovieResult[] }>("search/movie", {
      query,
      include_adult: false,
      language: "en-US",
      page: 1,
    });

    const ranked = data.results
      .map((result) => ({ result, score: computeSearchScore(result, query) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map(({ result }) => result);

    const mapped = ranked.map(mapMovie);
    await cacheMovies(mapped);

    return new Response(
      JSON.stringify({ results: mapped }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    if (error instanceof TMDBError) {
      if (error.status === 429) {
        return new Response(
          JSON.stringify({ error: "rate_limited", message: "TMDB rate limit exceeded" }),
          {
            status: 429,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      return apiError("tmdb_error", error.message, error.status);
    }
    throw error;
  }
}

export async function handleMovie(request: Request) {
  const url = new URL(request.url);
  const idParam = url.searchParams.get("id");
  if (!idParam) {
    return apiError("invalid_request", "Movie id is required", 400);
  }

  const tmdbId = Number(idParam);
  if (Number.isNaN(tmdbId)) {
    return apiError("invalid_request", "Movie id must be numeric", 400);
  }

  const forceRefresh = url.searchParams.get("refresh") === "1";

  const supabase = await getSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const ip = getClientIp(request);

  try {
    await enforceRateLimit("movie", [
      ...(userData?.user ? [{ actorId: userData.user.id, actorType: "user" as const, limit: 60 }] : []),
      ...(ip ? [{ actorId: ip, actorType: "ip" as const, limit: 120 }] : []),
    ]);
  } catch (error) {
    if (isRateLimitError(error)) {
      return new Response(
        JSON.stringify({ error: error.code, message: error.message }),
        {
          status: error.status,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(error.retryAfter),
          },
        }
      );
    }
    throw error;
  }

  const service = getSupabaseServiceRoleClient();
  const { data: cached, error: cacheError } = await service
    .from("movies")
    .select("*")
    .eq("tmdb_id", tmdbId)
    .maybeSingle();

  if (cacheError) throw cacheError;

  if (cached && !forceRefresh) {
    const isFresh = Date.now() - new Date(cached.updated_at).getTime() < SEVEN_DAYS_MS;
    if (isFresh) {
      return new Response(JSON.stringify({ movie: mapCachedMovie(cached) }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  try {
    const payload = await tmdbFetch<TMDBMovieResult>(`movie/${tmdbId}`);
    let mapped = mapMovie(payload);

    const fallbackPosterUrl = await findBestPosterImage(tmdbId, payload.poster_path ?? null);
    if (fallbackPosterUrl) {
      mapped = {
        ...mapped,
        posterUrl: fallbackPosterUrl,
        fallbackPosterUrl,
      };
    }

    await cacheMovies([mapped], { [mapped.tmdbId]: { ...payload, fallbackPosterUrl } });
    return new Response(JSON.stringify({ movie: mapped }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof TMDBError) {
      if (error.status === 404) {
        return apiError("not_found", "Movie not found", 404);
      }
      if (error.status === 429) {
        return apiError("rate_limited", "TMDB rate limit exceeded", 429);
      }
      return apiError("tmdb_error", error.message, error.status);
    }
    throw error;
  }
}

async function findBestPosterImage(movieId: number, currentPath: string | null) {
  try {
    const data = await tmdbFetch<TMDBImagesResult>(`movie/${movieId}/images`, {
      include_image_language: "en,null",
    });
    const posters = data.posters?.filter((poster) => poster.file_path) ?? [];
    if (!posters.length) return null;

    const sorted = posters.sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0));
    const preferredLanguages = ["en", null, "", undefined];

    let candidate: (typeof posters)[number] | undefined;
    for (const lang of preferredLanguages) {
      candidate = sorted.find((poster) => (poster.iso_639_1 ?? null) === lang);
      if (candidate) break;
    }
    if (!candidate) {
      candidate = sorted[0];
    }

    if (!candidate?.file_path) return null;
    if (currentPath && candidate.file_path === currentPath) {
      return null;
    }

    return buildImage(candidate.file_path, "w500");
  } catch (error) {
    console.warn(`Unable to fetch TMDB poster alternatives for movie ${movieId}`, error);
    return null;
  }
}
