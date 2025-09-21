"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api";
import { canCreateCollection, planGateMessage } from "@/lib/plan";
import { ensureUniqueSlug } from "@/lib/slugs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Collection, Database, Profile } from "@/lib/supabase/types";

interface CreateCollectionInput {
  title: string;
  description?: string | null;
  isPublic?: boolean;
}

async function getProfileOrThrow() {
  const cookieStore = await cookies();
  const supabase = await createSupabaseServerClient(cookieStore);

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;

  const user = userData?.user;
  if (!user) {
    throw new ApiError("not_authenticated", "You need to sign in", 401);
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new ApiError("profile_missing", "Complete your profile setup", 400);
  }

  return { profile: data as Profile, supabase, userId: user.id };
}

async function revalidatePublicCollection(profile: Profile, supabase: SupabaseClient<Database>, collectionId: string) {
  const { data } = await supabase
    .from("collections")
    .select("slug, is_public")
    .eq("id", collectionId)
    .maybeSingle();

  if (data?.is_public && data.slug) {
    revalidatePath(`/c/${profile.username}/${data.slug}`);
  }
}

export async function createCollectionAction(input: CreateCollectionInput) {
  const title = input.title?.trim();
  if (!title) {
    throw new ApiError("validation_error", "Title is required", 400);
  }

  const { profile, supabase, userId } = await getProfileOrThrow();

  const { count, error: countError } = await supabase
    .from("collections")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId);

  if (countError) throw countError;

  if (!canCreateCollection(profile, count ?? 0)) {
    throw new ApiError("plan_limit", planGateMessage(profile), 403);
  }

  const { data: existing, error: existingError } = await supabase
    .from("collections")
    .select("slug")
    .eq("owner_id", userId);

  if (existingError) throw existingError;

  const slug = ensureUniqueSlug(title, new Set((existing ?? []).map((row) => row.slug)));

  const { data, error } = await supabase
    .from("collections")
    .insert({
      owner_id: profile.id,
      title,
      slug,
      description: input.description ?? null,
      is_public: input.isPublic ?? false,
    })
    .select("*")
    .maybeSingle();

  if (error) throw error;

  revalidatePath("/app");
  return data as Collection;
}

export async function updateCollectionDetailsAction({
  collectionId,
  title,
  description,
  isPublic,
}: {
  collectionId: string;
  title?: string;
  description?: string | null;
  isPublic?: boolean;
}) {
  const { profile, supabase, userId } = await getProfileOrThrow();

  const { data: current, error: currentError } = await supabase
    .from("collections")
    .select("slug, is_public")
    .eq("id", collectionId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (currentError) throw currentError;
  if (!current) {
    throw new ApiError("not_found", "Collection not found", 404);
  }

  const previousSlug = current.slug;
  const wasPublic = current.is_public;

  const updates: Record<string, unknown> = {};

  if (typeof title === "string" && title.trim()) {
    const cleanTitle = title.trim();
    updates.title = cleanTitle;

    const { data: slugs, error: slugError } = await supabase
      .from("collections")
      .select("id, slug")
      .eq("owner_id", userId);
    if (slugError) throw slugError;
    const otherSlugs = new Set((slugs ?? []).filter((row) => row.id !== collectionId).map((row) => row.slug));
    updates.slug = ensureUniqueSlug(cleanTitle, otherSlugs);
  }

  if (description !== undefined) {
    updates.description = description;
  }

  if (typeof isPublic === "boolean") {
    updates.is_public = isPublic;
  }

  if (Object.keys(updates).length === 0) {
    throw new ApiError("validation_error", "No updates provided", 400);
  }

  const { error } = await supabase
    .from("collections")
    .update(updates)
    .eq("id", collectionId)
    .eq("owner_id", userId);

  if (error) throw error;

  revalidatePath("/app");
  revalidatePath(`/collections/${collectionId}`);

  const nextSlug = (updates.slug as string | undefined) ?? previousSlug;
  const nextIsPublic =
    typeof updates.is_public === "boolean" ? (updates.is_public as boolean) : wasPublic;

  if (wasPublic) {
    revalidatePath(`/c/${profile.username}/${previousSlug}`);
  }
  if (nextIsPublic) {
    revalidatePath(`/c/${profile.username}/${nextSlug}`);
  }

  return { ok: true } as const;
}

export async function deleteCollectionAction(collectionId: string) {
  const { profile, supabase, userId } = await getProfileOrThrow();

  const { data: existing } = await supabase
    .from("collections")
    .select("slug, is_public")
    .eq("id", collectionId)
    .eq("owner_id", userId)
    .maybeSingle();

  const { error } = await supabase
    .from("collections")
    .delete()
    .eq("id", collectionId)
    .eq("owner_id", userId);
  if (error) throw error;

  revalidatePath("/app");
  if (existing?.is_public && existing?.slug) {
    revalidatePath(`/c/${profile.username}/${existing.slug}`);
  }
  return { ok: true } as const;
}

interface AddMovieInput {
  collectionId: string;
  movie: {
    tmdbId: number;
    title: string;
    releaseYear: number | null;
    posterUrl: string | null;
    backdropUrl: string | null;
    overview: string | null;
    runtime: number | null;
    genres: { id: number; name: string }[];
  };
}

export async function addMovieToCollectionAction(input: AddMovieInput) {
  const { profile, supabase, userId } = await getProfileOrThrow();
  const { collectionId, movie } = input;

  const ownerCheck = await supabase
    .from("collections")
    .select("owner_id")
    .eq("id", collectionId)
    .maybeSingle();

  if (ownerCheck.error) throw ownerCheck.error;
  if (!ownerCheck.data || ownerCheck.data.owner_id !== userId) {
    throw new ApiError("forbidden", "You do not own this collection", 403);
  }

  const { data: countData, error: countError } = await supabase
    .from("collection_items")
    .select("position")
    .eq("collection_id", collectionId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (countError && countError.code !== "PGRST116") throw countError;
  const nextPosition = typeof countData?.position === "number" ? countData.position + 1 : 0;

  const { error: insertError } = await supabase.from("collection_items").insert({
    collection_id: collectionId,
    tmdb_id: movie.tmdbId,
    position: nextPosition,
  });

  if (insertError && insertError.code !== "23505") {
    throw insertError;
  }

  const service = getSupabaseServiceRoleClient();
  const { error: upsertError } = await service
    .from("movies")
    .upsert({
      tmdb_id: movie.tmdbId,
      title: movie.title,
      release_year: movie.releaseYear,
      poster_url: movie.posterUrl,
      backdrop_url: movie.backdropUrl,
      runtime: movie.runtime,
      genres: movie.genres,
      tmdb_json: {
        overview: movie.overview,
      },
    });
  if (upsertError) throw upsertError;

  revalidatePath(`/collections/${collectionId}`);
  revalidatePath("/app");
  await revalidatePublicCollection(profile, supabase, collectionId);
  return { ok: true } as const;
}

export async function removeCollectionItemAction({
  collectionItemId,
  collectionId,
}: {
  collectionItemId: string;
  collectionId: string;
}) {
  const { profile, supabase, userId } = await getProfileOrThrow();

  const ownerCheck = await supabase
    .from("collections")
    .select("owner_id")
    .eq("id", collectionId)
    .maybeSingle();

  if (ownerCheck.error) throw ownerCheck.error;
  if (!ownerCheck.data || ownerCheck.data.owner_id !== userId) {
    throw new ApiError("forbidden", "You do not own this collection", 403);
  }

  const { error } = await supabase
    .from("collection_items")
    .delete()
    .eq("id", collectionItemId)
    .eq("collection_id", collectionId);
  if (error) throw error;
  revalidatePath(`/collections/${collectionId}`);
  revalidatePath("/app");
  await revalidatePublicCollection(profile, supabase, collectionId);
  return { ok: true } as const;
}

export async function updateCollectionItemNoteAction({
  collectionItemId,
  note,
  collectionId,
}: {
  collectionItemId: string;
  note: string;
  collectionId: string;
}) {
  const { profile, supabase, userId } = await getProfileOrThrow();

  const ownerCheck = await supabase
    .from("collections")
    .select("owner_id")
    .eq("id", collectionId)
    .maybeSingle();

  if (ownerCheck.error) throw ownerCheck.error;
  if (!ownerCheck.data || ownerCheck.data.owner_id !== userId) {
    throw new ApiError("forbidden", "You do not own this collection", 403);
  }

  const { error } = await supabase
    .from("collection_items")
    .update({ note })
    .eq("id", collectionItemId)
    .eq("collection_id", collectionId);
  if (error) throw error;
  revalidatePath(`/collections/${collectionId}`);
  await revalidatePublicCollection(profile, supabase, collectionId);
  return { ok: true } as const;
}

export async function reorderCollectionItemsAction({
  collectionId,
  orderedIds,
}: {
  collectionId: string;
  orderedIds: { id: string; position: number }[];
}) {
  const { profile, supabase, userId } = await getProfileOrThrow();

  const ownerCheck = await supabase
    .from("collections")
    .select("owner_id")
    .eq("id", collectionId)
    .maybeSingle();

  if (ownerCheck.error) throw ownerCheck.error;
  if (!ownerCheck.data || ownerCheck.data.owner_id !== userId) {
    throw new ApiError("forbidden", "You do not own this collection", 403);
  }

  const existing = await supabase
    .from("collection_items")
    .select("id, tmdb_id")
    .eq("collection_id", collectionId);

  if (existing.error) throw existing.error;

  const tmdbMap = new Map(existing.data?.map((item) => [item.id, item.tmdb_id] as const));

  const payload = orderedIds.map((item) => {
    const tmdbId = tmdbMap.get(item.id);
    if (!tmdbId) {
      throw new ApiError("missing_item", "Unable to reorder: item not found", 400);
    }
    return {
      id: item.id,
      collection_id: collectionId,
      tmdb_id: tmdbId,
      position: item.position,
    };
  });

  const { error } = await supabase.from("collection_items").upsert(payload, { onConflict: "id" });
  if (error) throw error;
  revalidatePath(`/collections/${collectionId}`);
  await revalidatePublicCollection(profile, supabase, collectionId);
  return { ok: true } as const;
}
