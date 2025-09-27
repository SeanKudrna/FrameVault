/**
 * Server component for the authenticated collection editor. It gathers all
 * collection metadata, associated items, and cached TMDB movies before handing
 * the data off to the interactive editor UI.
 */

import { notFound, redirect } from "next/navigation";
import { CollectionEditor } from "@/components/collections/collection-editor";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile, Movie, WatchStatus } from "@/lib/supabase/types";
import type { CollectionItemWithMovie } from "@/types/collection";

/**
 * Route params accepted by the collection editor page.
 */
interface PageParams {
  params: Promise<{ collectionId: string }> | { collectionId: string };
}

/**
 * Server-rendered collection editor that loads collection data, movies, and passes them to the editor UI.
 */
export default async function CollectionEditorPage({ params }: PageParams) {
  const { collectionId } = await params;
  const supabase = await getSupabaseServerClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  const user = userData?.user;
  if (!user) {
    redirect("/auth/sign-in");
  }

  const profileResponse = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profileResponse.error) throw profileResponse.error;
  if (!profileResponse.data) {
    redirect("/settings/profile");
  }

  const collectionResponse = await supabase
    .from("collections")
    .select(
      "id, title, slug, description, previous_slugs, is_public, created_at, updated_at, owner_id, cover_image_url, theme, collection_items(id, tmdb_id, position, note, rating, added_at)"
    )
    .eq("id", collectionId)
    .maybeSingle();

  if (collectionResponse.error) throw collectionResponse.error;
  const collection = collectionResponse.data;
  if (!collection || collection.owner_id !== user.id) {
    notFound();
  }

  const items = collection.collection_items ?? [];
  const tmdbIds = items.map((item) => item.tmdb_id);

  const moviesMap = new Map<number, Movie>();
  if (tmdbIds.length > 0) {
    const moviesResponse = await supabase
      .from("movies")
      .select("tmdb_id, title, release_year, poster_url, backdrop_url, genres, runtime, tmdb_json")
      .in("tmdb_id", tmdbIds);

    if (moviesResponse.error) throw moviesResponse.error;
    for (const movie of moviesResponse.data ?? []) {
      moviesMap.set(movie.tmdb_id, movie);
    }
  }

  const viewLogMap = new Map<number, { status: WatchStatus; watched_at: string | null }>();
  if (tmdbIds.length > 0) {
    const viewLogResponse = await supabase
      .from("view_logs")
      .select("tmdb_id, status, watched_at")
      .eq("user_id", user.id)
      .in("tmdb_id", tmdbIds);

    if (viewLogResponse.error) throw viewLogResponse.error;
    for (const log of viewLogResponse.data ?? []) {
      viewLogMap.set(log.tmdb_id, { status: log.status as WatchStatus, watched_at: log.watched_at });
    }
  }

  // Combine the raw collection items with their cached TMDB metadata, filling
  // in optional fields (overview, vote average) from the JSON payload to avoid
  // issuing additional TMDB requests on the client.
  const mappedItems: CollectionItemWithMovie[] = items
    .map((item) => {
      const movie = moviesMap.get(item.tmdb_id) ?? null;
      const overview =
        movie?.tmdb_json && typeof movie.tmdb_json === "object" && "overview" in movie.tmdb_json
          ? (movie.tmdb_json as Record<string, unknown>)["overview"]
          : null;
      const voteAverage =
        movie?.tmdb_json && typeof movie.tmdb_json === "object" && "vote_average" in movie.tmdb_json
          ? Number((movie.tmdb_json as Record<string, unknown>)["vote_average"])
          : null;
      const fallbackPosterUrl =
        movie?.tmdb_json && typeof movie.tmdb_json === "object" && "fallbackPosterUrl" in movie.tmdb_json
          ? ((movie.tmdb_json as Record<string, unknown>)["fallbackPosterUrl"] as string | null)
          : null;

      return {
        id: item.id,
        collection_id: collectionId,
        tmdb_id: item.tmdb_id,
        position: item.position,
        note: item.note,
        rating: item.rating,
        added_at: item.added_at,
        viewStatus: viewLogMap.get(item.tmdb_id)?.status ?? null,
        watchedAt: viewLogMap.get(item.tmdb_id)?.watched_at ?? null,
        movie: movie
          ? {
              tmdbId: movie.tmdb_id,
              title: movie.title ?? "Untitled",
              releaseYear: movie.release_year ?? null,
              overview: (overview as string | null) ?? null,
              posterUrl: movie.poster_url ?? null,
              fallbackPosterUrl,
              backdropUrl: movie.backdrop_url ?? null,
              genres: (movie.genres as { id: number; name: string }[] | null) ?? [],
              runtime: movie.runtime ?? null,
              voteAverage,
            }
          : null,
      };
    })
    .sort((a, b) => a.position - b.position);

  return (
    <CollectionEditor
      collection={{
        id: collection.id,
        title: collection.title,
        slug: collection.slug,
        description: collection.description,
        previous_slugs: collection.previous_slugs ?? [],
        is_public: collection.is_public,
        created_at: collection.created_at,
        updated_at: collection.updated_at,
        cover_image_url: collection.cover_image_url ?? null,
        theme: (collection.theme as Record<string, unknown> | null) ?? null,
      }}
      profile={profileResponse.data as Profile}
      items={mappedItems}
    />
  );
}
