import { getSupabaseServiceRoleClient } from "@/lib/supabase/service";

const WINDOW_MS = 60 * 1000;

interface RateLimitActor {
  actorType: "user" | "ip";
  actorId: string;
  limit: number;
}

export async function enforceRateLimit(bucket: "search" | "movie", actors: RateLimitActor[]) {
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

export interface RateLimitError extends Error {
  code: "rate_limited";
  status: 429;
  retryAfter: number;
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return typeof error === "object" && error !== null && (error as RateLimitError).code === "rate_limited";
}
