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
  return {
    tmdbId: row.tmdb_id,
    title: row.title ?? "Untitled",
    overview: row.tmdb_json && typeof row.tmdb_json === "object" && "overview" in row.tmdb_json ? (row.tmdb_json as Record<string, unknown>)["overview"] as string | null : null,
    posterUrl: row.poster_url,
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

    const mapped = data.results.slice(0, 20).map(mapMovie);
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

  if (cached) {
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
    const mapped = mapMovie(payload);
    await cacheMovies([mapped], { [mapped.tmdbId]: payload });
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
