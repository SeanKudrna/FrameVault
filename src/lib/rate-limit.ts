/**
 * Shared rate limiting utilities for API routes (TMDB proxy + exports). All
 * counters live in Supabase so multiple server instances see the same usage.
 */

import { getSupabaseServiceRoleClient } from "@/lib/supabase/service";

/**
 * Duration of each rate-limit window. Requests are counted per minute which
 * keeps the calculations simple (floor timestamps to the nearest minute) while
 * still protecting the upstream API from bursts.
 */
const WINDOW_MS = 60 * 1000;

/**
 * Describes an actor (user or IP) that should be tracked for rate limiting,
 * including the maximum number of requests allowed in the current window. Each
 * actor is checked independently so we can combine per-user and per-IP buckets
 * for extra safety.
 */
interface RateLimitActor {
  actorType: "user" | "ip";
  actorId: string;
  limit: number;
}

/**
 * Ensures each actor stays within the allowed request threshold for the given
 * TMDB bucket. Throws a `RateLimitError` when the limit is exceeded so callers
 * can respond accordingly with `429` responses or custom UI.
 *
 * The function performs a single read (if present) followed by an update or
 * insert so that each request increments the counter exactly once per actor.
 * Any unexpected Supabase error is rethrown to surface infrastructure issues
 * loudly.
 */
export async function enforceRateLimit(
  bucket: "search" | "movie" | "export" | "providers" | "recommendations",
  actors: RateLimitActor[]
) {
  const supabase = getSupabaseServiceRoleClient();
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / WINDOW_MS) * WINDOW_MS);
  const windowEnd = new Date(windowStart.getTime() + WINDOW_MS);

  for (const actor of actors) {
    if (!actor.actorId) continue;

    const { data, error } = await supabase
      .from("tmdb_rate_limit")
      .select("id, request_count, window_end")
      .eq("actor_type", actor.actorType)
      .eq("actor", actor.actorId)
      .eq("bucket", bucket)
      .eq("window_start", windowStart.toISOString())
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    if (data) {
      if (data.request_count >= actor.limit) {
        const retryAfter = Math.max(0, Math.ceil((new Date(data.window_end).getTime() - now) / 1000));
        const err: RateLimitError = Object.assign(new Error(`Try again in ${retryAfter} seconds`), {
          code: "rate_limited",
          status: 429 as const,
          retryAfter,
        });
        throw err;
      }

      const update = await supabase
        .from("tmdb_rate_limit")
        .update({ request_count: data.request_count + 1 })
        .eq("id", data.id);

      if (update.error) throw update.error;
    } else {
      const insert = await supabase.from("tmdb_rate_limit").insert({
        actor: actor.actorId,
        actor_type: actor.actorType,
        bucket,
        window_start: windowStart.toISOString(),
        window_end: windowEnd.toISOString(),
        request_count: 1,
      });
      if (insert.error) throw insert.error;
    }
  }
}

/**
 * Error type thrown when rate limiting prevents a request from proceeding. The
 * `retryAfter` value is expressed in seconds to align with the HTTP header and
 * is used by the API routes to set the `Retry-After` response header.
 */
export interface RateLimitError extends Error {
  code: "rate_limited";
  status: 429;
  retryAfter: number;
}

/**
 * Type guard that narrows unknown errors into the custom `RateLimitError` shape
 * so `catch` blocks can confidently access `retryAfter` without defensive
 * casting.
 */
export function isRateLimitError(error: unknown): error is RateLimitError {
  return typeof error === "object" && error !== null && (error as RateLimitError).code === "rate_limited";
}
