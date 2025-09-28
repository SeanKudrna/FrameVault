import { notFound } from "next/navigation";
import { DiscoverGrid, DiscoverCollection } from "@/components/discover/discover-grid";
import { ProfileHeader } from "@/components/discover/profile-header";
import { getSupabaseServerClient } from "@/lib/supabase/server";

interface PageProps {
  params: Promise<{ username: string }> | { username: string };
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { username } = await params;
  const supabase = await getSupabaseServerClient();

  const [{ data: userData }] = await Promise.all([
    supabase.auth.getUser(),
  ]);
  const viewer = userData?.user ?? null;

  const profileResponse = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .filter("lower(username)", "eq", username.toLowerCase())
    .maybeSingle();

  if (profileResponse.error) throw profileResponse.error;
  const profile = profileResponse.data;
  if (!profile) {
    notFound();
  }

  const followerCountResponse = await supabase
    .from("follows")
    .select("follower_id", { head: true, count: "exact" })
    .eq("followee_id", profile.id);

  if (followerCountResponse.error) throw followerCountResponse.error;
  const followerCount = followerCountResponse.count ?? 0;

  let isFollowing = false;
  if (viewer) {
    const followingResponse = await supabase
      .from("follows")
      .select("follower_id")
      .eq("followee_id", profile.id)
      .eq("follower_id", viewer.id)
      .maybeSingle();
    if (followingResponse.error && followingResponse.error.code !== "PGRST116") {
      throw followingResponse.error;
    }
    isFollowing = Boolean(followingResponse.data);
  }

  const collectionsResponse = await supabase
    .from("collections")
    .select("id, title, slug, description, updated_at, cover_image_url, collection_items(count)")
    .eq("owner_id", profile.id)
    .eq("is_public", true)
    .order("updated_at", { ascending: false })
    .limit(24);

  if (collectionsResponse.error) throw collectionsResponse.error;

  const collections: DiscoverCollection[] = (collectionsResponse.data ?? []).map((row) => {
    const itemCount = Array.isArray(row.collection_items)
      ? (row.collection_items[0]?.count as number | undefined) ?? 0
      : 0;
    const updatedAt = row.updated_at ?? new Date().toISOString();
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      description: row.description,
      updatedAt,
      coverImageUrl: row.cover_image_url,
      itemCount,
      followerCount,
      badge: followerCount >= 5 ? "popular" : isRecent(updatedAt) ? "new" : null,
      owner: {
        id: profile.id,
        username: profile.username,
        displayName: profile.display_name,
        avatarUrl: profile.avatar_url,
      },
    };
  });

  const initialFollowedOwnerIds = viewer && isFollowing ? [profile.id] : [];

  return (
    <div className="space-y-8">
      <ProfileHeader
        ownerId={profile.id}
        username={profile.username}
        displayName={profile.display_name}
        avatarUrl={profile.avatar_url}
        followerCount={followerCount}
        isFollowing={isFollowing}
        viewerId={viewer?.id ?? null}
      />
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-100">Public collections</h2>
        {collections.length ? (
          <DiscoverGrid
            collections={collections}
            initialFollowedOwnerIds={initialFollowedOwnerIds}
            viewerId={viewer?.id ?? null}
          />
        ) : (
          <p className="rounded-3xl border border-dashed border-slate-800/60 bg-slate-950/50 p-8 text-sm text-slate-400">
            No public collections yet. Check back soon.
          </p>
        )}
      </section>
    </div>
  );
}

function isRecent(updatedAt: string) {
  const updated = new Date(updatedAt).getTime();
  const now = Date.now();
  const fiveDays = 5 * 24 * 60 * 60 * 1000;
  return now - updated < fiveDays;
}
