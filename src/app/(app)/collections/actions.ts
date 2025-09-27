"use server";

import { Buffer } from "node:buffer";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api";
import { canCreateCollection, planGateMessage } from "@/lib/plan";
import { ensureUniqueSlug } from "@/lib/slugs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Collection, Database, Profile, WatchStatus } from "@/lib/supabase/types";

/**
 * Payload used when creating a new collection from the dashboard.
 */
interface CreateCollectionInput {
  title: string;
  description?: string | null;
  isPublic?: boolean;
}

/**
 * Loads the authenticated profile and server Supabase client or throws descriptive errors.
 */
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

/**
 * Revalidates the public collection route when relevant data changes.
 */
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

/**
 * Creates a new collection after enforcing plan limits and unique slugs.
 */
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

/**
 * Updates collection metadata (title, description, visibility) and handles slug revalidation.
 */
export async function updateCollectionDetailsAction({
  collectionId,
  title,
  description,
  isPublic,
  coverImageUrl,
  theme,
}: {
  collectionId: string;
  title?: string;
  description?: string | null;
  isPublic?: boolean;
  coverImageUrl?: string | null;
  theme?: Record<string, unknown> | null;
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

  if (coverImageUrl !== undefined) {
    if (profile.plan === "free") {
      throw new ApiError("plan_limit", "Upgrade to Plus to customize covers", 403);
    }
    updates.cover_image_url = coverImageUrl;
  }

  if (theme !== undefined) {
    if (profile.plan === "free") {
      throw new ApiError("plan_limit", "Upgrade to Plus to customize themes", 403);
    }
    updates.theme = theme;
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

/**
 * Deletes a collection owned by the authenticated user and revalidates dependent paths.
 */
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
  // Revalidate collection detail and user collection pages
  revalidatePath(`/collections/${collectionId}`);
  revalidatePath(`/app/collections/${collectionId}`);
  if (existing?.is_public && existing?.slug) {
    revalidatePath(`/c/${profile.username}/${existing.slug}`);
  }
  return { ok: true } as const;
}

interface SetViewStatusInput {
  tmdbId: number;
  status: WatchStatus | null;
  watchedAt?: string | null;
}

/**
 * Sets or clears the user's view status for a TMDB title. Persists to `view_logs`.
 */
export async function setViewStatusAction({ tmdbId, status, watchedAt }: SetViewStatusInput) {
  if (!Number.isFinite(tmdbId)) {
    throw new ApiError("validation_error", "A valid tmdbId is required", 400);
  }

  const { profile, supabase } = await getProfileOrThrow();

  if (!status) {
    const { error } = await supabase
      .from("view_logs")
      .delete()
      .eq("user_id", profile.id)
      .eq("tmdb_id", tmdbId);

    if (error) throw error;
  } else {
    const payload = {
      user_id: profile.id,
      tmdb_id: tmdbId,
      status,
      watched_at: status === "watched" ? watchedAt ?? new Date().toISOString() : null,
    };

    const { error } = await supabase
      .from("view_logs")
      .upsert(payload, { onConflict: "user_id, tmdb_id" });

    if (error) throw error;
  }

  revalidatePath("/app/history");
  return { ok: true } as const;
}

/**
 * Uploads a collection cover image to Supabase storage and persists the public URL.
 */
export async function uploadCollectionCoverAction(formData: FormData) {
  const collectionId = formData.get("collectionId");
  const file = formData.get("file");

  if (!collectionId || typeof collectionId !== "string") {
    throw new ApiError("validation_error", "collectionId is required", 400);
  }

  if (!(file instanceof File)) {
    throw new ApiError("validation_error", "A file upload is required", 400);
  }

  if (!file.type.startsWith("image/")) {
    throw new ApiError("validation_error", "Cover images must be an image file", 400);
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new ApiError("validation_error", "Cover images must be 5MB or smaller", 400);
  }

  const { profile } = await getProfileOrThrow();
  if (profile.plan === "free") {
    throw new ApiError("plan_limit", "Upgrade to Plus to customize covers", 403);
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const extension = file.type === "image/png" ? "png" : "jpg";
  const storagePath = `${profile.id}/${collectionId}-${Date.now()}.${extension}`;

  const service = getSupabaseServiceRoleClient();
  const { error: uploadError } = await service.storage.from("covers").upload(storagePath, buffer, {
    contentType: file.type,
    upsert: true,
  });

  if (uploadError) throw uploadError;

  const { data: publicUrlData } = service.storage.from("covers").getPublicUrl(storagePath);
  const publicUrl = publicUrlData?.publicUrl ?? null;
  if (!publicUrl) {
    throw new ApiError("upload_failed", "Unable to resolve cover URL", 500);
  }

  await updateCollectionDetailsAction({ collectionId, coverImageUrl: publicUrl });

  return { url: publicUrl } as const;
}

/**
 * Payload accepted when adding a TMDB movie to a collection.
 */
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

/**
 * Inserts a TMDB movie into a collection and caches its metadata.
 */
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

/**
 * Removes a collection item after verifying ownership.
 */
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

/**
 * Updates the note attached to a specific collection item.
 */
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

/**
 * Persists a new order for collection items based on drag-and-drop results.
 */
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
