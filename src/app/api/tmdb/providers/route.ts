import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { enforceRateLimit, isRateLimitError } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { fetchWatchProviders } from "@/lib/tmdb";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const movieParam = url.searchParams.get("movieId");
  if (!movieParam) {
    return apiError("invalid_request", "movieId query parameter is required", 400);
  }

  const tmdbId = Number.parseInt(movieParam, 10);
  if (!Number.isFinite(tmdbId)) {
    return apiError("invalid_request", "movieId must be numeric", 400);
  }

  const forceRefresh = url.searchParams.get("refresh") === "1";
  const regionParam = url.searchParams.get("region");

  const supabase = await getSupabaseServerClient();
  const [{ data: userData, error: userError }] = await Promise.all([
    supabase.auth.getUser(),
  ]);

  if (userError) {
    return apiError("supabase_error", userError.message, 500);
  }

  const user = userData?.user ?? null;
  let preferredRegion = "US";

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("preferred_region")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.preferred_region) {
      preferredRegion = profile.preferred_region;
    }
  }

  if (regionParam) {
    preferredRegion = regionParam.toUpperCase();
  }

  const ip = getClientIp(request);
  try {
    await enforceRateLimit("providers", [
      ...(user ? [{ actorId: user.id, actorType: "user" as const, limit: 120 }] : []),
      ...(ip ? [{ actorId: ip, actorType: "ip" as const, limit: 200 }] : []),
    ]);
  } catch (error) {
    if (isRateLimitError(error)) {
      return new NextResponse(
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
    const providers = await fetchWatchProviders(tmdbId, preferredRegion, forceRefresh);
    return NextResponse.json({ providers }, { status: 200 });
  } catch (error) {
    console.error("Failed to load watch providers", error);
    return apiError("tmdb_error", "Unable to load watch providers", 500);
  }
}
