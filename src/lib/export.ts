import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Plan } from "@/lib/supabase/types";

export interface ExportItem {
  id: string;
  tmdb_id: number;
  position: number;
  note: string | null;
  rating: number | null;
  added_at: string;
  movie: {
    title: string | null;
    release_year: number | null;
    poster_url: string | null;
    overview: string | null;
  };
}

export interface ExportCollection {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  theme: Record<string, unknown> | null;
  cover_image_url: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  items: ExportItem[];
}

export interface ExportPayload {
  profile: {
    id: string;
    username: string;
    display_name: string | null;
    plan: Plan;
  };
  collections: ExportCollection[];
}

export async function loadExportPayload(
  supabase: SupabaseClient<Database>,
  userId: string,
  profileOverride?: {
    id: string;
    username: string;
    display_name: string | null;
    plan: Plan;
  }
): Promise<ExportPayload> {
  let profile = profileOverride ?? null;
  if (!profile) {
    const profileResponse = await supabase
      .from("profiles")
      .select("id, username, display_name, plan")
      .eq("id", userId)
      .maybeSingle();

    if (profileResponse.error) throw profileResponse.error;
    if (!profileResponse.data) {
      throw new Error("Profile not found");
    }
    profile = {
      id: profileResponse.data.id,
      username: profileResponse.data.username,
      display_name: profileResponse.data.display_name,
      plan: profileResponse.data.plan as Plan,
    };
  }

  const collectionsResponse = await supabase
    .from("collections")
    .select(
      "id, title, slug, description, theme, cover_image_url, is_public, created_at, updated_at, collection_items(id, tmdb_id, position, note, rating, added_at)"
    )
    .eq("owner_id", userId)
    .order("created_at", { ascending: true });

  if (collectionsResponse.error) throw collectionsResponse.error;

  const collections = collectionsResponse.data ?? [];
  const tmdbIds = new Set<number>();

  for (const collection of collections) {
    for (const item of collection.collection_items ?? []) {
      tmdbIds.add(item.tmdb_id);
    }
  }

  const moviesMap = new Map<number, Database["public"]["Tables"]["movies"]["Row"]>();
  if (tmdbIds.size > 0) {
    const moviesResponse = await supabase
      .from("movies")
      .select("tmdb_id, title, release_year, poster_url, tmdb_json")
      .in("tmdb_id", Array.from(tmdbIds));

    if (moviesResponse.error) throw moviesResponse.error;
    for (const movie of moviesResponse.data ?? []) {
      moviesMap.set(movie.tmdb_id, movie);
    }
  }

  const mappedCollections: ExportCollection[] = collections.map((collection) => {
    const items = (collection.collection_items ?? [])
      .map((item) => {
        const movie = moviesMap.get(item.tmdb_id) ?? null;
        const overview =
          movie?.tmdb_json && typeof movie.tmdb_json === "object" && "overview" in movie.tmdb_json
            ? (movie.tmdb_json as Record<string, unknown>)["overview"]
            : null;
        return {
          id: item.id,
          tmdb_id: item.tmdb_id,
          position: item.position,
          note: item.note,
          rating: item.rating,
          added_at: item.added_at,
          movie: {
            title: movie?.title ?? null,
            release_year: movie?.release_year ?? null,
            poster_url: movie?.poster_url ?? null,
            overview: (overview as string | null) ?? null,
          },
        } satisfies ExportItem;
      })
      .sort((a, b) => a.position - b.position);

    return {
      id: collection.id,
      title: collection.title,
      slug: collection.slug,
      description: collection.description,
      theme: (collection.theme as Record<string, unknown> | null) ?? null,
      cover_image_url: collection.cover_image_url ?? null,
      is_public: collection.is_public,
      created_at: collection.created_at,
      updated_at: collection.updated_at,
      items,
    } satisfies ExportCollection;
  });

  return {
    profile: {
      id: profile.id,
      username: profile.username,
      display_name: profile.display_name,
      plan: profile.plan,
    },
    collections: mappedCollections,
  };
}
