"use server";

import { Buffer } from "node:buffer";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api";
import { canCreateCollection, computeEffectivePlan, planGateMessage } from "@/lib/plan";
import { ensureUniqueSlug } from "@/lib/slugs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Collection, CollectionCollaborator, Database, Profile, WatchStatus } from "@/lib/supabase/types";

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
  if (userError) {
    // Handle session missing errors gracefully (user may have signed out)
    if (userError.message.includes('Auth session missing')) {
      throw new ApiError("not_authenticated", "You need to sign in", 401);
    }
    throw userError;
  }

  const user = userData?.user;
  if (!user) {
    throw new ApiError("not_authenticated", "You need to sign in", 401);
  }

  await computeEffectivePlan(supabase, user.id);

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

interface CollectionAccessResult {
  isOwner: boolean;
  collaboratorRole: string | null;
  isCollaborator: boolean;
}

/**
 * Ensures the current member has edit rights over the target collection. Owners
 * and collaborators with non-viewer roles are permitted. Throws when the
 * collection is missing or inaccessible.
 */
async function ensureCollectionEditorAccess(
  supabase: SupabaseClient<Database>,
  collectionId: string,
  userId: string,
  options?: { requireEdit?: boolean }
): Promise<CollectionAccessResult> {
  const { data, error } = await supabase
    .from("collections")
    .select("id, owner_id, collection_collaborators(user_id, role)")
    .eq("id", collectionId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new ApiError("not_found", "Collection not found", 404);
  }

  const collaborators = Array.isArray(data.collection_collaborators)
    ? (data.collection_collaborators as CollectionCollaborator[])
    : [];

  const collaborator = collaborators.find((row) => row.user_id === userId) ?? null;
  const isOwner = data.owner_id === userId;
  const isEditor = collaborator ? collaborator.role !== "viewer" : false;

  const requireEdit = options?.requireEdit ?? true;
  if (requireEdit) {
    if (!isOwner && !isEditor) {
      throw new ApiError("forbidden", "You do not have permission to edit this collection", 403);
    }
  } else if (!isOwner && !collaborator) {
    throw new ApiError("forbidden", "You do not have access to this collection", 403);
  }

  return { isOwner, collaboratorRole: collaborator?.role ?? null, isCollaborator: Boolean(collaborator) };
}

/**
 * Revalidates public collection paths for a given collection, ensuring new or
 * previous slugs are refreshed when visibility changes. Uses the service role
 * client so collaborators can trigger revalidation without needing owner
 * context.
 */
async function revalidateCollectionCache(collectionId: string, options?: { previousSlug?: string | null }) {
  const service = getSupabaseServiceRoleClient();
  const { data, error } = await service
    .from("collections")
    .select("slug, is_public, owner:profiles!collections_owner_id_fkey(username)")
    .eq("id", collectionId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load collection for revalidation", error);
    return;
  }

  const ownerUsername = data?.owner?.username as string | undefined;
  if (!ownerUsername) return;

  const previousSlug = options?.previousSlug ?? null;
  if (previousSlug) {
    revalidatePath(`/c/${ownerUsername}/${previousSlug}`);
  }

  if (data?.is_public && data.slug) {
    revalidatePath(`/c/${ownerUsername}/${data.slug}`);
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
  if (data?.id) {
    revalidatePath(`/app/collections/${data.id}`);
  }
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
  await revalidateCollectionCache(collectionId, {
    previousSlug: wasPublic ? previousSlug : null,
  });

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
  const { supabase, userId } = await getProfileOrThrow();
  const { collectionId, movie } = input;

  await ensureCollectionEditorAccess(supabase, collectionId, userId);

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
  const { data: existingMovie, error: existingMovieError } = await service
    .from("movies")
    .select("tmdb_json")
    .eq("tmdb_id", movie.tmdbId)
    .maybeSingle();
  if (existingMovieError && existingMovieError.code !== "PGRST116") throw existingMovieError;

  const mergedJson: Record<string, unknown> =
    existingMovie?.tmdb_json && typeof existingMovie.tmdb_json === "object"
      ? { ...(existingMovie.tmdb_json as Record<string, unknown>) }
      : {};

  if (movie.overview && !mergedJson.overview) {
    mergedJson.overview = movie.overview;
  }

  const upsertPayload: Record<string, unknown> = {
    tmdb_id: movie.tmdbId,
    title: movie.title,
    release_year: movie.releaseYear,
    poster_url: movie.posterUrl,
    backdrop_url: movie.backdropUrl,
    runtime: movie.runtime,
    genres: movie.genres,
  };

  if (Object.keys(mergedJson).length > 0) {
    upsertPayload.tmdb_json = mergedJson;
  }

  const { error: upsertError } = await service.from("movies").upsert(upsertPayload, { onConflict: "tmdb_id" });
  if (upsertError) throw upsertError;

  revalidatePath(`/collections/${collectionId}`);
  revalidatePath("/app");
  await revalidateCollectionCache(collectionId);
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
  const { supabase, userId } = await getProfileOrThrow();
  await ensureCollectionEditorAccess(supabase, collectionId, userId);

  const { error } = await supabase
    .from("collection_items")
    .delete()
    .eq("id", collectionItemId)
    .eq("collection_id", collectionId);
  if (error) throw error;
  revalidatePath(`/collections/${collectionId}`);
  revalidatePath("/app");
  await revalidateCollectionCache(collectionId);
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
  const { supabase, userId } = await getProfileOrThrow();
  await ensureCollectionEditorAccess(supabase, collectionId, userId);

  const { error } = await supabase
    .from("collection_items")
    .update({ note })
    .eq("id", collectionItemId)
    .eq("collection_id", collectionId);
  if (error) throw error;
  revalidatePath(`/collections/${collectionId}`);
  await revalidateCollectionCache(collectionId);
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
  const { supabase, userId } = await getProfileOrThrow();
  await ensureCollectionEditorAccess(supabase, collectionId, userId);

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
  await revalidateCollectionCache(collectionId);
  return { ok: true } as const;
}

interface InviteCollaboratorInput {
  collectionId: string;
  identifier: string;
  role?: "editor" | "viewer";
}

/**
 * Invites a collaborator to a collection using their username or email. Only
 * owners on the Pro plan can add collaborators.
 */
export async function inviteCollectionCollaboratorAction({ collectionId, identifier, role = "editor" }: InviteCollaboratorInput) {
  const { profile, supabase, userId } = await getProfileOrThrow();

  if (profile.plan !== "pro") {
    throw new ApiError("plan_limit", "Upgrade to Pro to add collaborators", 403);
  }

  const access = await ensureCollectionEditorAccess(supabase, collectionId, userId);
  if (!access.isOwner) {
    throw new ApiError("forbidden", "Only owners can manage collaborators", 403);
  }

  const trimmed = identifier.trim();
  if (!trimmed) {
    throw new ApiError("validation_error", "Provide a username or email to invite", 400);
  }

  let targetProfile: Profile | null = null;
  if (trimmed.includes("@")) {
    const service = getSupabaseServiceRoleClient();
    const { data, error } = await service.auth.admin.getUserByEmail(trimmed);
    if (error) throw error;
    const authUser = data?.user;
    if (!authUser) {
      throw new ApiError("not_found", "No FrameVault account matches that email", 404);
    }
    const profileResponse = await supabase.from("profiles").select("*").eq("id", authUser.id).maybeSingle();
    if (profileResponse.error) throw profileResponse.error;
    if (!profileResponse.data) {
      throw new ApiError("profile_missing", "That member needs to finish onboarding before collaborating", 400);
    }
    targetProfile = profileResponse.data as Profile;
  } else {
    const profileResponse = await supabase
      .from("profiles")
      .select("*")
      .ilike("username", trimmed)
      .maybeSingle();
    if (profileResponse.error) throw profileResponse.error;
    if (!profileResponse.data) {
      throw new ApiError("not_found", "No user with that username", 404);
    }
    targetProfile = profileResponse.data as Profile;
  }

  if (!targetProfile) {
    throw new ApiError("not_found", "Unable to locate member", 404);
  }

  if (targetProfile.id === userId) {
    throw new ApiError("validation_error", "You already own this collection", 400);
  }

  const existing = await supabase
    .from("collection_collaborators")
    .select("user_id")
    .eq("collection_id", collectionId)
    .eq("user_id", targetProfile.id)
    .maybeSingle();
  if (existing.error && existing.error.code !== "PGRST116") throw existing.error;
  if (existing.data) {
    throw new ApiError("conflict", "That collaborator is already added", 409);
  }

  const { error: insertError } = await supabase
    .from("collection_collaborators")
    .insert({
      collection_id: collectionId,
      owner_id: profile.id,
      user_id: targetProfile.id,
      role,
    });
  if (insertError) throw insertError;

  revalidatePath(`/collections/${collectionId}`);
  revalidatePath("/app");
  await revalidateCollectionCache(collectionId);

  return {
    collaborator: {
      id: targetProfile.id,
      username: targetProfile.username,
      displayName: targetProfile.display_name,
      avatarUrl: targetProfile.avatar_url,
      role,
    },
  } as const;
}

interface RemoveCollaboratorInput {
  collectionId: string;
  userId: string;
}

/**
 * Removes a collaborator from a collection. Owners can remove anyone; collaborators may remove themselves.
 */
export async function removeCollectionCollaboratorAction({ collectionId, userId: collaboratorId }: RemoveCollaboratorInput) {
  const { supabase, userId } = await getProfileOrThrow();
  const isSelfRemoval = collaboratorId === userId;
  const access = await ensureCollectionEditorAccess(supabase, collectionId, userId, {
    requireEdit: !isSelfRemoval,
  });

  if (!access.isOwner && !isSelfRemoval) {
    throw new ApiError("forbidden", "Only the owner can remove other collaborators", 403);
  }

  const { error } = await supabase
    .from("collection_collaborators")
    .delete()
    .eq("collection_id", collectionId)
    .eq("user_id", collaboratorId);
  if (error) throw error;

  revalidatePath(`/collections/${collectionId}`);
  revalidatePath("/app");
  await revalidateCollectionCache(collectionId);

  return { ok: true } as const;
}
