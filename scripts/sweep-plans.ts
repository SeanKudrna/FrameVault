import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/env";
import type { Database } from "@/lib/supabase/types";

async function main() {
  const env = getServerEnv();
  const supabase = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc("expire_lapsed_plans", { batch_size: 500 } as any);
  if (error) {
    throw error;
  }

  const results = (data as any[]) ?? [];
  if (results.length === 0) {
    console.log("No plans required expiry");
    return;
  }

  for (const entry of results) {
    console.log(
      `Expired plan for ${entry.user_id}: ${entry.previous_plan} -> ${entry.new_plan}`
    );
  }

  console.log(`Expired ${results.length} plan(s)`);
}

main().catch((error) => {
  console.error("Plan sweep failed", error);
  process.exit(1);
});
