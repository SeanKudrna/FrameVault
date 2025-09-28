/**
 * TMDB integration helpers. This module acts as the core of our proxy layer by
 * handling requests to the TMDB API, caching responses in Supabase, and exposing
 * a simplified `MovieSummary` structure to the rest of the app.
 */

import { getServerEnv } from "@/env";
import { apiError } from "@/lib/api";
import { enforceRateLimit, isRateLimitError } from "@/lib/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service";
import type { Movie } from "@/lib/supabase/types";
import { getClientIp } from "@/lib/request";

/**
 * Milliseconds in a week; used when determining whether cached movie metadata
 * is still fresh enough to serve without contacting TMDB again.
 */
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const PROVIDERS_TTL_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Server environment variables captured once to avoid repeated lookups.
 */
const env = getServerEnv();

const TMDB_GENRE_LOOKUP: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
};

export function resolveGenreName(id: number, provided?: string | null) {
  const cleaned = (provided ?? "").trim();
  if (cleaned.length > 0 && cleaned.toLowerCase() !== "unknown") {
    return cleaned;
  }
  return TMDB_GENRE_LOOKUP[id] ?? "Unknown";
}

/**
 * Lightweight representation of a TMDB movie that is safe to return to clients or store locally.
 */
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
  tagline?: string | null;
}

export interface MovieCastMember {
  id: number;
  name: string;
  character: string | null;
  order: number | null;
  profileUrl: string | null;
}

export interface MovieCrewMember {
  id: number;
  name: string;
  job: string | null;
  department: string | null;
}

export interface MovieReview {
  id: string;
  author: string;
  username: string | null;
  rating: number | null;
  createdAt: string | null;
  content: string;
  url: string | null;
}

export interface MovieDetail extends MovieSummary {
  cast: MovieCastMember[];
  crew: MovieCrewMember[];
  reviews: MovieReview[];
}

export interface ProviderBadge {
  id: number;
  name: string;
  logoUrl: string | null;
}

export interface WatchProviderGroup {
  region: string;
  link: string | null;
  stream: ProviderBadge[];
  rent: ProviderBadge[];
  buy: ProviderBadge[];
  availableRegions: string[];
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
  tagline?: string | null;
  credits?: {
    cast?: Array<{
      id: number;
      name?: string;
      character?: string;
      order?: number;
      profile_path?: string | null;
    }>;
    crew?: Array<{
      id: number;
      name?: string;
      job?: string;
      department?: string;
    }>;
  };
  reviews?: {
    results?: Array<{
      id: string;
      author?: string;
      content?: string;
      url?: string;
      created_at?: string;
      updated_at?: string;
      author_details?: {
        name?: string;
        username?: string;
        rating?: number | null;
        avatar_path?: string | null;
      };
    }>;
  };
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

interface TMDBWatchProvider {
  provider_id: number;
  provider_name?: string;
  logo_path?: string | null;
  display_priority?: number | null;
}

interface TMDBWatchProviderRegion {
  link?: string;
  flatrate?: TMDBWatchProvider[];
  rent?: TMDBWatchProvider[];
  buy?: TMDBWatchProvider[];
}

interface TMDBWatchProvidersResponse {
  results?: Record<string, TMDBWatchProviderRegion | undefined>;
}

/**
 * Internal error used for bubbling TMDB API failures with their status code intact.
 */
class TMDBError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Formats a TMDB image path into a fully qualified URL for the desired size.
 */
function buildImage(path: string | null | undefined, size: "w500" | "w780" | "w1280" = "w500") {
  if (!path) return null;
  return `${env.TMDB_IMAGE_BASE}/${size}${path}`;
}

/**
 * Maps a TMDB API response into the simplified `MovieSummary` structure used by the app.
 */
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
      (payload.genre_ids?.map((id) => ({ id, name: resolveGenreName(id) })) ?? []),
    runtime: payload.runtime ?? null,
    voteAverage: payload.vote_average ?? null,
    tagline: payload.tagline ?? null,
  };
}

/**
 * Converts a cached Supabase `movies` row back into the `MovieSummary` representation.
 */
export function mapCachedMovie(row: Movie): MovieSummary {
  let fallbackPosterUrl: string | null = null;
  if (row.tmdb_json && typeof row.tmdb_json === "object" && "fallbackPosterUrl" in row.tmdb_json) {
    const fallback = (row.tmdb_json as Record<string, unknown>)["fallbackPosterUrl"];
    fallbackPosterUrl = typeof fallback === "string" ? fallback : null;
  }
  const cachedGenres = Array.isArray(row.genres)
    ? (row.genres as { id: number; name?: string | null }[]).map((genre) => ({
        id: genre.id,
        name: resolveGenreName(genre.id, genre.name ?? null),
      }))
    : [];
  const tmdbJson = (row.tmdb_json ?? {}) as Record<string, unknown>;
  return {
    tmdbId: row.tmdb_id,
    title: row.title ?? "Untitled",
    overview: typeof tmdbJson.overview === "string" ? tmdbJson.overview : null,
    posterUrl: row.poster_url ?? fallbackPosterUrl,
    fallbackPosterUrl,
    backdropUrl: row.backdrop_url,
    releaseYear: row.release_year ?? null,
    genres: cachedGenres,
    runtime: row.runtime ?? null,
    voteAverage: typeof tmdbJson.vote_average === "number" ? tmdbJson.vote_average : null,
    tagline: typeof tmdbJson.tagline === "string" ? tmdbJson.tagline : null,
  };
}

/**
 * Fetches a movie summary by TMDB id, using cached Supabase data when available and
 * refreshing from TMDB as needed. Returns null when the movie cannot be resolved.
 */
export async function getMovieSummaryById(tmdbId: number, options: { refresh?: boolean } = {}) {
  if (!Number.isFinite(tmdbId)) {
    throw new TypeError("tmdbId must be a finite number");
  }

  const service = getSupabaseServiceRoleClient();
  const { data: cached, error: cacheError } = await service
    .from("movies")
    .select("*")
    .eq("tmdb_id", tmdbId)
    .maybeSingle();

  if (cacheError && cacheError.code !== "PGRST116") {
    throw cacheError;
  }

  const shouldRefresh = options.refresh === true;
  if (cached && !shouldRefresh) {
    return mapCachedMovie(cached);
  }

  try {
    const payload = await tmdbFetch<TMDBMovieResult>(`movie/${tmdbId}`, {
      append_to_response: "credits",
      language: "en-US",
    });

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
    return mapped;
  } catch (error) {
    if (cached) {
      return mapCachedMovie(cached);
    }
    if (error instanceof TMDBError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

function mapCastMember(member: NonNullable<TMDBMovieResult["credits"]>["cast"][number]): MovieCastMember {
  return {
    id: member.id,
    name: member.name ?? "Unknown",
    character: member.character ?? null,
    order: typeof member.order === "number" ? member.order : null,
    profileUrl: member.profile_path ? buildImage(member.profile_path, "w185") : null,
  };
}

function mapCrewMember(member: NonNullable<TMDBMovieResult["credits"]>["crew"][number]): MovieCrewMember {
  return {
    id: member.id,
    name: member.name ?? "Unknown",
    job: member.job ?? null,
    department: member.department ?? null,
  };
}

function mapReview(review: NonNullable<TMDBMovieResult["reviews"]>["results"][number]): MovieReview {
  const authorDetails = review.author_details ?? {};
  return {
    id: review.id,
    author: review.author || authorDetails.name || authorDetails.username || "TMDB User",
    username: authorDetails.username ?? null,
    rating: typeof authorDetails.rating === "number" ? authorDetails.rating : null,
    createdAt: review.created_at ?? review.updated_at ?? null,
    content: review.content ?? "",
    url: review.url ?? null,
  };
}

export async function getMovieDetail(tmdbId: number, options: { refresh?: boolean } = {}): Promise<MovieDetail | null> {
  if (!Number.isFinite(tmdbId)) {
    throw new TypeError("tmdbId must be a finite number");
  }

  const service = getSupabaseServiceRoleClient();
  const { data: cached, error: cacheError } = await service
    .from("movies")
    .select("*")
    .eq("tmdb_id", tmdbId)
    .maybeSingle();
  if (cacheError && cacheError.code !== "PGRST116") {
    throw cacheError;
  }

  const shouldRefresh = options.refresh === true;
  let payload: TMDBMovieResult | null = null;
  if (cached && !shouldRefresh && cached.tmdb_json && typeof cached.tmdb_json === "object") {
    payload = cached.tmdb_json as TMDBMovieResult;
  }

  let summary: MovieSummary | null = cached ? mapCachedMovie(cached) : null;

  if (!payload || !payload.reviews || shouldRefresh) {
    const freshPayload = await tmdbFetch<TMDBMovieResult>(`movie/${tmdbId}`, {
      append_to_response: "credits,reviews",
      language: "en-US",
    });

    let mapped = mapMovie(freshPayload);
    const fallbackPosterUrl = await findBestPosterImage(tmdbId, freshPayload.poster_path ?? null);
    if (fallbackPosterUrl) {
      mapped = {
        ...mapped,
        posterUrl: fallbackPosterUrl,
        fallbackPosterUrl,
      };
    }

    await cacheMovies([mapped], { [mapped.tmdbId]: { ...freshPayload, fallbackPosterUrl } });
    payload = freshPayload;
    summary = mapped;
  }

  if (!summary) {
    if (!payload) return null;
    summary = mapMovie(payload);
  }

  const cast = payload?.credits?.cast ? payload.credits.cast.slice(0, 12).map(mapCastMember) : [];
  const crew = payload?.credits?.crew ? payload.credits.crew.map(mapCrewMember) : [];
  const reviews = payload?.reviews?.results
    ? payload.reviews.results
        .map(mapReview)
        .filter((review) => review.content.trim().length > 0)
        .slice(0, 20)
    : [];

  return {
    ...summary,
    tagline: payload?.tagline ?? summary.tagline ?? null,
    cast,
    crew,
    reviews,
  };
}

/**
 * Normalises search strings for comparison by removing punctuation and lowercasing.
 */
function normalizeSearchValue(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Breaks a query into tokens for fuzzy matching against candidate titles.
 */
function tokenizeSearchValue(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Scores a TMDB search result using a blend of exact matches, token overlap,
 * popularity, vote data, and release recency to improve ranking quality. Higher
 * scores float to the top of the search results list. The weighting is tuned to
 * favour exact or prefix matches first, then lean on popularity metrics when
 * multiple films share similar names.
 */
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

function normaliseRegion(region: string) {
  return region?.toUpperCase() || "US";
}

function mapProviderList(list?: TMDBWatchProvider[]) {
  if (!Array.isArray(list)) return [] as ProviderBadge[];

  return list
    .filter((provider): provider is TMDBWatchProvider => Boolean(provider?.provider_id))
    .sort((a, b) => {
      const aPriority = a.display_priority ?? 999;
      const bPriority = b.display_priority ?? 999;
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      const aName = a.provider_name ?? "";
      const bName = b.provider_name ?? "";
      return aName.localeCompare(bName);
    })
    .slice(0, 12)
    .map((provider) => ({
      id: provider.provider_id,
      name: provider.provider_name ?? "Unknown",
      logoUrl: buildImage(provider.logo_path, "w154"),
    }));
}

function mapWatchProvidersPayload(payload: TMDBWatchProvidersResponse | null, preferredRegion: string): WatchProviderGroup | null {
  const results = payload?.results ?? {};
  const availableRegions = Object.keys(results).sort();

  if (availableRegions.length === 0) {
    return null;
  }

  const target = normaliseRegion(preferredRegion);
  const regionKey = results[target]
    ? target
    : results.US
    ? "US"
    : availableRegions[0];

  const region = results[regionKey];
  if (!region) {
    return null;
  }

  return {
    region: regionKey,
    link: region.link ?? null,
    stream: mapProviderList(region.flatrate),
    rent: mapProviderList(region.rent),
    buy: mapProviderList(region.buy),
    availableRegions,
  };
}

/**
 * Persists the provided movies in Supabase so future requests can serve cached metadata quickly.
 */
async function cacheMovies(movies: MovieSummary[], tmdbPayloads?: Record<number, unknown>) {
  if (!movies.length) return;
  const service = getSupabaseServiceRoleClient();
  const rows = movies.map((movie) => ({
    tmdb_id: movie.tmdbId,
    title: movie.title,
    release_year: movie.releaseYear,
    poster_url: movie.posterUrl,
    backdrop_url: movie.backdropUrl,
    genres: movie.genres.map((genre) => ({
      id: genre.id,
      name: resolveGenreName(genre.id, genre.name),
    })),
    runtime: movie.runtime,
    tmdb_json:
      tmdbPayloads?.[movie.tmdbId] ?? {
        overview: movie.overview,
        vote_average: movie.voteAverage,
        fallbackPosterUrl: movie.fallbackPosterUrl ?? null,
        tagline: movie.tagline ?? null,
      },
  }));

  const { error } = await service
    .from("movies")
    .upsert(rows, { onConflict: "tmdb_id" });
  if (error) throw error;
}

/**
 * Performs an authenticated request against the TMDB API, throwing `TMDBError` on failure.
 */
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

/**
 * Loads streaming availability information for a movie, caching TMDB responses
 * in Supabase to avoid repeated network calls. Falls back to cached results if
 * TMDB is unavailable.
 */
export async function fetchWatchProviders(
  tmdbId: number,
  region = "US",
  forceRefresh = false
): Promise<WatchProviderGroup | null> {
  const service = getSupabaseServiceRoleClient();
  const { data: cachedRow, error: cachedError } = await service
    .from("movies")
    .select("watch_providers, updated_at")
    .eq("tmdb_id", tmdbId)
    .maybeSingle();

  if (cachedError && cachedError.code !== "PGRST116") {
    throw cachedError;
  }

  let payload = (cachedRow?.watch_providers ?? null) as TMDBWatchProvidersResponse | null;
  const updatedAtMs = cachedRow?.updated_at ? Date.parse(cachedRow.updated_at) : 0;
  const isStale =
    forceRefresh ||
    !payload ||
    !updatedAtMs ||
    Date.now() - updatedAtMs > PROVIDERS_TTL_MS;

  if (isStale) {
    try {
      const fresh = await tmdbFetch<TMDBWatchProvidersResponse>(`movie/${tmdbId}/watch/providers`);
      payload = fresh;

      if (cachedRow) {
        const { error } = await service
          .from("movies")
          .update({ watch_providers: fresh })
          .eq("tmdb_id", tmdbId);
        if (error) throw error;
      } else {
        const { error } = await service
          .from("movies")
          .insert({ tmdb_id: tmdbId, watch_providers: fresh });
        if (error) throw error;
      }
    } catch (error) {
      if (!payload) {
        throw error;
      }
      console.warn("TMDB providers refresh failed; serving cached data", error);
    }
  }

  return mapWatchProvidersPayload(payload, region);
}

export interface DiscoverMoviesParams {
  withGenres?: number[];
  voteAverageGte?: number;
  voteCountGte?: number;
  releaseDateGte?: string;
  sortBy?: string;
  page?: number;
}

/**
 * Wraps TMDB's `/discover/movie` endpoint and caches summaries in Supabase.
 */
export async function discoverMovies(params: DiscoverMoviesParams): Promise<MovieSummary[]> {
  const query: Record<string, string | number | boolean | undefined> = {
    include_adult: false,
    language: "en-US",
    sort_by: params.sortBy ?? "popularity.desc",
    page: params.page ?? 1,
    vote_average_gte: params.voteAverageGte ?? 6,
    vote_count_gte: params.voteCountGte ?? 200,
  };

  if (params.withGenres?.length) {
    query.with_genres = params.withGenres.slice(0, 3).join(",");
  }
  if (params.releaseDateGte) {
    query["primary_release_date.gte"] = params.releaseDateGte;
  }

  const data = await tmdbFetch<{ results: TMDBMovieResult[] }>("discover/movie", query);
  const mapped = data.results.map(mapMovie);
  await cacheMovies(mapped);
  return mapped;
}

/**
 * Handles `/api/tmdb/search` requests by validating input, enforcing rate limits, ranking
 * TMDB results, caching them, and returning the serialised movie summaries.
 */
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

/**
 * Handles `/api/tmdb/movie` requests by serving cached metadata when fresh, otherwise fetching
 * from TMDB, refreshing the cache, and returning the mapped summary.
 */
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
    const payload = await tmdbFetch<TMDBMovieResult>(`movie/${tmdbId}`, {
      append_to_response: "credits",
      language: "en-US",
    });
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

/**
 * Attempts to find a higher-quality fallback poster for a TMDB movie, preferring English artwork.
 */
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
