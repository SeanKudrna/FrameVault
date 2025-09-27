import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { enforceRateLimit, isRateLimitError } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";
import { getSmartPicksForUser } from "@/lib/recommendations";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await getSupabaseServerClient();
  const [{ data: userData, error: userError }] = await Promise.all([
    supabase.auth.getUser(),
  ]);

  if (userError) {
    return apiError("supabase_error", userError.message, 500);
  }

  const user = userData?.user;
  if (!user) {
    return apiError("not_authenticated", "Sign in to view Smart Picks", 401);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return apiError("profile_error", profileError.message, 500);
  }

  if (!profile || profile.plan !== "pro") {
    return apiError("plan_required", "Upgrade to Pro for Smart Picks", 403);
  }

  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const excludeParam = url.searchParams.get("exclude");

  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
  const excludeTmdbIds = excludeParam
    ? excludeParam
        .split(",")
        .map((value) => Number.parseInt(value.trim(), 10))
        .filter((value) => Number.isFinite(value))
    : undefined;

  try {
    const ip = getClientIp(request);
    await enforceRateLimit("recommendations", [
      { actorId: user.id, actorType: "user", limit: 30 },
      ...(ip ? [{ actorId: ip, actorType: "ip" as const, limit: 60 }] : []),
    ]);

    const result = await getSmartPicksForUser(user.id, { limit, excludeTmdbIds });
    return NextResponse.json(result, { status: 200 });
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
    console.error("Smart picks failed", error);
    return apiError("recommendations_error", "Unable to generate Smart Picks at the moment", 500);
  }
}
