import type { MetadataRoute } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/env";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";

const PAGE_SIZE = 1000;
const PROFILE_CHUNK = 1000;

async function hydrateUsernames(
  service: SupabaseClient<Database>,
  ownerIds: string[],
  cache: Map<string, string>
) {
  const missing = ownerIds.filter((id) => !cache.has(id));
  if (missing.length === 0) {
    return;
  }

  for (let index = 0; index < missing.length; index += PROFILE_CHUNK) {
    const chunk = missing.slice(index, index + PROFILE_CHUNK);
    const { data, error } = await service
      .from("profiles")
      .select("id, username")
      .in("id", chunk);
    if (error) throw error;
    for (const profile of data ?? []) {
      cache.set(profile.id, profile.username);
    }
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const env = getServerEnv();
  const baseUrl = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const service = getSupabaseServiceRoleClient();

  const entries: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/pricing`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  const ownerCache = new Map<string, string>();

  for (let page = 0; ; page += 1) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await service
      .from("collections")
      .select("owner_id, slug, updated_at")
      .eq("is_public", true)
      .order("updated_at", { ascending: false })
      .range(from, to);

    if (error) throw error;
    if (!data || data.length === 0) {
      break;
    }

    const ownerIds = Array.from(new Set(data.map((row) => row.owner_id)));
    await hydrateUsernames(service, ownerIds, ownerCache);

    for (const row of data) {
      const username = ownerCache.get(row.owner_id);
      if (!username) continue;
      entries.push({
        url: `${baseUrl}/c/${username}/${row.slug}`,
        lastModified: row.updated_at ? new Date(row.updated_at) : undefined,
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }

    if (data.length < PAGE_SIZE) {
      break;
    }
  }

  return entries;
}
