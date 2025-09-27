import { redirect } from "next/navigation";
import { DiscoverGrid, DiscoverCollection } from "@/components/discover/discover-grid";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function DiscoverPage() {
  const supabase = await getSupabaseServerClient();
  const [{ data: userData, error: userError }] = await Promise.all([
    supabase.auth.getUser(),
  ]);

  if (userError) {
    throw userError;
  }

  const user = userData?.user;
  if (!user) {
    redirect("/auth/sign-in");
  }

  const collectionsResponse = await supabase
    .from("collections")
    .select(
      "id, title, slug, description, updated_at, cover_image_url, owner:profiles!collections_owner_id_fkey(id, username, display_name, avatar_url), collection_items(count)"
    )
    .eq("is_public", true)
    .order("updated_at", { ascending: false })
    .limit(40);

  if (collectionsResponse.error) {
    throw collectionsResponse.error;
  }

  const rawCollections = collectionsResponse.data ?? [];
  const ownerIds = Array.from(new Set(rawCollections.map((row) => row.owner?.id).filter(Boolean)));

  const followRowsResponse = ownerIds.length
    ? await supabase.from("follows").select("follower_id, followee_id").in("followee_id", ownerIds)
    : { data: [], error: null };

  if (followRowsResponse.error) throw followRowsResponse.error;

  const followerMap = new Map<string, number>();
  const followedByViewer = new Set<string>();
  for (const row of followRowsResponse.data ?? []) {
    const followee = row.followee_id as string;
    followerMap.set(followee, (followerMap.get(followee) ?? 0) + 1);
    if (row.follower_id === user.id) {
      followedByViewer.add(followee);
    }
  }

  const collections: DiscoverCollection[] = rawCollections.map((row) => {
    const itemCount = Array.isArray(row.collection_items)
      ? (row.collection_items[0]?.count as number | undefined) ?? 0
      : 0;
    const followerCount = row.owner?.id ? followerMap.get(row.owner.id) ?? 0 : 0;
    const updatedAt = row.updated_at ?? new Date().toISOString();
    const badge = followerCount >= 5 ? "popular" : isRecent(updatedAt) ? "new" : null;
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      description: row.description,
      updatedAt,
      coverImageUrl: row.cover_image_url,
      itemCount,
      followerCount,
      badge,
      owner: {
        id: row.owner?.id ?? "",
        username: row.owner?.username ?? "",
        displayName: row.owner?.display_name ?? null,
        avatarUrl: row.owner?.avatar_url ?? null,
      },
    };
  });

  collections.sort((a, b) => {
    if (b.followerCount !== a.followerCount) {
      return b.followerCount - a.followerCount;
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const initialFollowedOwnerIds = Array.from(followedByViewer);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-100">Discover collections</h1>
        <p className="text-sm text-slate-400">Trending public shelves from the FrameVault community.</p>
      </header>
      <DiscoverGrid collections={collections} initialFollowedOwnerIds={initialFollowedOwnerIds} viewerId={user.id} />
    </div>
  );
}

function isRecent(updatedAt: string) {
  const updated = new Date(updatedAt).getTime();
  const now = Date.now();
  const fiveDays = 5 * 24 * 60 * 60 * 1000;
  return now - updated < fiveDays;
}
