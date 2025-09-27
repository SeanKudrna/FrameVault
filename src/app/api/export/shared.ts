import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { ApiError } from "@/lib/api";
import { loadExportPayload } from "@/lib/export";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Plan } from "@/lib/supabase/types";

export async function prepareExportPayload(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = await createSupabaseServerClient(cookieStore);

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const user = userData?.user;
  if (!user) {
    throw new ApiError("not_authenticated", "Please sign in to export your data", 401);
  }

  const profileResponse = await supabase
    .from("profiles")
    .select("id, username, display_name, plan")
    .eq("id", user.id)
    .maybeSingle();

  if (profileResponse.error) throw profileResponse.error;
  if (!profileResponse.data) {
    throw new ApiError("profile_missing", "Complete your profile before exporting", 400);
  }

  const plan = profileResponse.data.plan as Plan;
  if (plan === "free") {
    throw new ApiError("plan_limit", "Upgrade to Plus to export your data", 403);
  }

  const actors = [{ actorType: "user" as const, actorId: user.id, limit: 1 }];
  const ip = getClientIp(request);
  if (ip) {
    actors.push({ actorType: "ip" as const, actorId: ip, limit: 3 });
  }
  await enforceRateLimit("export", actors);

  const payload = await loadExportPayload(supabase, user.id, {
    id: profileResponse.data.id,
    username: profileResponse.data.username,
    display_name: profileResponse.data.display_name,
    plan,
  });

  return payload;
}
