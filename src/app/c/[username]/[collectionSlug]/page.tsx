/**
 * Public reader experience for shared collections. Handles slug history,
 * metadata generation, and rendering of cached TMDB data.
 */

import Image from "next/image";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CalendarDays, Film, Sparkles } from "lucide-react";
import { getServerEnv } from "@/env";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Movie } from "@/lib/supabase/types";
import { PosterImage } from "@/components/media/poster-image";
import { PublicShareActions } from "@/components/collections/public-share-actions";
import { extractThemeId, getThemeConfig } from "@/lib/themes";

/**
 * Params and search params provided to the public collection routes.
 */
interface PageProps {
  params: Promise<{ username: string; collectionSlug: string }> | { username: string; collectionSlug: string };
  searchParams: { id?: string } | Promise<{ id?: string }>;
}

/**
 * Minimal profile projection needed for public pages.
 */
interface PublicProfileRow {
  id: string;
  username: string;
  display_name: string | null;
}

/**
 * Collection item row returned when loading public collections.
 */
interface CollectionItemRow {
  position: number;
  note: string | null;
  tmdb_id: number;
}

/**
 * Public collection structure pulled from Supabase.
 */
interface PublicCollectionRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  previous_slugs: string[] | null;
  is_public: boolean;
  updated_at: string;
  cover_image_url: string | null;
  theme: Record<string, unknown> | null;
  collection_items?: CollectionItemRow[];
}

/**
 * Arguments controlling how `loadPublicCollection` queries Supabase.
 */
interface LoadPublicCollectionArgs {
  supabase: SupabaseClient<Database>;
  username: string;
  slug: string;
  searchId?: string;
  includeItems: boolean;
}

/**
 * Result from loading a public collection, including redirect info when slugs changed.
 */
interface LoadPublicCollectionResult {
  profile: PublicProfileRow | null;
  collection: PublicCollectionRow | null;
  redirectSlug?: string;
}

/**
 * Fetches a public collection by slug, accounting for historic slugs and
 * optional ID lookups. The helper returns redirect information so callers can
 * issue permanent redirects without executing duplicate queries.
 */
async function loadPublicCollection({
  supabase,
  username,
  slug,
  searchId,
  includeItems,
}: LoadPublicCollectionArgs): Promise<LoadPublicCollectionResult> {
  const usernameLower = username.toLowerCase();
  const profileResponse = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .filter("lower(username)", "eq", usernameLower)
    .maybeSingle();

  if (profileResponse.error) throw profileResponse.error;

  const profile = profileResponse.data as PublicProfileRow | null;
  if (!profile) {
    return { profile: null, collection: null };
  }

  const baseSelect =
    "id, title, slug, description, previous_slugs, is_public, updated_at, cover_image_url, theme";
  const collectionSelect = includeItems
    ? `${baseSelect}, collection_items(position, note, tmdb_id)`
    : baseSelect;

  const slugLower = slug.toLowerCase();
  const collectionResponse = await supabase
    .from("collections")
    .select(collectionSelect)
    .eq("owner_id", profile.id)
    .eq("slug", slugLower)
    .maybeSingle();

  if (collectionResponse.error) throw collectionResponse.error;

  const collection = collectionResponse.data as PublicCollectionRow | null;
  if (collection) {
    return { profile, collection };
  }

  const historicResponse = await supabase
    .from("collections")
    .select("slug")
    .eq("owner_id", profile.id)
    .contains("previous_slugs", [slugLower])
    .maybeSingle();

  if (historicResponse.error) throw historicResponse.error;
  if (historicResponse.data) {
    return { profile, collection: null, redirectSlug: historicResponse.data.slug };
  }

  if (searchId) {
    const byIdResponse = await supabase
      .from("collections")
      .select("slug")
      .eq("owner_id", profile.id)
      .eq("id", searchId)
      .maybeSingle();

    if (byIdResponse.error) throw byIdResponse.error;
    if (byIdResponse.data) {
      return { profile, collection: null, redirectSlug: byIdResponse.data.slug };
    }
  }

  return { profile, collection: null };
}

/**
 * Generates SEO metadata for public collection pages, handling slug redirects gracefully.
 */
export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { username, collectionSlug } = await params;
  const query = await searchParams;
  const supabase = await getSupabaseServerClient();
  const { profile, collection, redirectSlug } = await loadPublicCollection({
    supabase,
    username,
    slug: collectionSlug,
    searchId: query?.id,
    includeItems: false,
  });

  if (!profile) {
    notFound();
  }

  if (redirectSlug) {
    return {};
  }

  if (!collection || !collection.is_public) {
    notFound();
  }

  const env = getServerEnv();
  const curator = profile.display_name ?? profile.username;
  const title = `${collection.title} — Curated by ${curator}`;
  const description =
    collection.description ?? `A curated film collection by ${curator}.`;
  const siteBase = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const canonical = `${siteBase}/c/${profile.username}/${collection.slug}`;
  const ogImages = collection.cover_image_url ? [collection.cover_image_url] : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonical,
      type: "article",
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImages,
    },
    alternates: {
      canonical,
    },
  };
}

/**
 * Public-facing collection page showing curated titles and curator notes.
 */
export default async function PublicCollectionPage({ params, searchParams }: PageProps) {
  const { username, collectionSlug } = await params;
  const query = await searchParams;
  const supabase = await getSupabaseServerClient();

  const { profile, collection, redirectSlug } = await loadPublicCollection({
    supabase,
    username,
    slug: collectionSlug,
    searchId: query?.id,
    includeItems: true,
  });

  if (!profile) {
    notFound();
  }

  if (redirectSlug) {
    redirect(`/c/${profile.username}/${redirectSlug}`);
  }

  if (!collection || !collection.is_public) {
    notFound();
  }

  const items = collection.collection_items ?? [];
  const tmdbIds = items.map((item) => item.tmdb_id);
  const moviesMap = new Map<number, Movie>();

  if (tmdbIds.length > 0) {
    const moviesResponse = await supabase
      .from("movies")
      .select("tmdb_id, title, release_year, poster_url, tmdb_json")
      .in("tmdb_id", tmdbIds);

    if (moviesResponse.error) throw moviesResponse.error;
    for (const movie of moviesResponse.data ?? []) {
      moviesMap.set(movie.tmdb_id, movie);
    }
  }

  // Transform the raw collection items into a render-friendly shape, merging in
  // cached TMDB data (poster, overview, release year) to keep the UI stateless.
  const mappedItems = items
    .map((item) => {
      const movie = moviesMap.get(item.tmdb_id) ?? null;
      const overview =
        movie?.tmdb_json && typeof movie.tmdb_json === "object" && "overview" in movie.tmdb_json
          ? (movie.tmdb_json as Record<string, unknown>)["overview"]
          : null;
      const fallbackPosterUrl =
        movie?.tmdb_json && typeof movie.tmdb_json === "object" && "fallbackPosterUrl" in movie.tmdb_json
          ? ((movie.tmdb_json as Record<string, unknown>)["fallbackPosterUrl"] as string | null)
          : null;
      return {
        id: `${collection.id}-${item.position}`,
        position: item.position,
        note: item.note,
        movie: {
          tmdbId: item.tmdb_id,
          title: movie?.title ?? "Untitled",
          posterUrl: movie?.poster_url ?? null,
          fallbackPosterUrl,
          releaseYear: movie?.release_year ?? null,
          overview: (overview as string | null) ?? null,
        },
      };
    })
    .sort((a, b) => a.position - b.position);

  const themeConfig = getThemeConfig(extractThemeId(collection.theme));

  const env = getServerEnv();
  const siteBase = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const shareUrl = `${siteBase}/c/${profile.username}/${collection.slug}`;
  const lastUpdated = new Date(collection.updated_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const totalItems = mappedItems.length;
  const accentColor = themeConfig?.accent ?? undefined;
  const accentSoft = themeConfig ? `${themeConfig.accent}22` : undefined;

  return (
    <div className="min-h-screen bg-slate-950">
      <div
        className="relative h-[260px] w-full overflow-hidden bg-slate-900/50 sm:h-[320px]"
        style={
          themeConfig
            ? {
                backgroundImage: `linear-gradient(135deg, ${themeConfig.gradient.from}, ${themeConfig.gradient.via}, ${themeConfig.gradient.to})`,
              }
            : undefined
        }
      >
        {collection.cover_image_url ? (
          <Image
            src={collection.cover_image_url}
            alt={`${collection.title} cover`}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/10 via-slate-950/60 to-slate-950" />
      </div>

      <div className="relative -mt-24 pb-16 sm:-mt-32">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6">
          <header className="space-y-6 rounded-3xl border border-slate-800/70 bg-slate-950/80 p-8 shadow-[0_40px_160px_-100px_rgba(15,23,42,0.9)] backdrop-blur">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-3 text-left">
                <p
                  className="text-xs uppercase tracking-[0.24em] text-indigo-200"
                  style={{ color: accentColor ?? undefined }}
                >
                  Curated by {profile.display_name ?? profile.username}
                </p>
                <h1 className="text-balance text-4xl font-semibold text-slate-100 sm:text-5xl">
                  {collection.title}
                </h1>
                {collection.description ? (
                  <p className="max-w-2xl text-sm text-slate-300">{collection.description}</p>
                ) : null}
              </div>
            <PublicShareActions
              shareUrl={shareUrl}
              accentColor={themeConfig?.accent}
              accentForeground={themeConfig?.accentForeground}
            />
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-slate-800/70 bg-slate-900/60 p-5 text-sm text-slate-300 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-800/70"
                style={{ backgroundColor: accentSoft, color: accentColor }}
              >
                <Sparkles size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-100">{profile.display_name ?? profile.username}</p>
                <p className="text-xs text-slate-500">@{profile.username}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 text-xs text-slate-400 sm:flex-row sm:items-center sm:gap-6">
              <div className="inline-flex items-center gap-2">
                <Film size={16} style={{ color: accentColor ?? undefined }} />
                <span>{totalItems} {totalItems === 1 ? "film" : "films"}</span>
              </div>
              <div className="inline-flex items-center gap-2">
                <CalendarDays size={16} style={{ color: accentColor ?? undefined }} />
                <span>Updated {lastUpdated}</span>
              </div>
            </div>
            </div>
          </header>

          <section className="space-y-6">
            {mappedItems.map((item) => (
              <article
                key={item.id}
                className="flex flex-col gap-4 rounded-3xl border border-slate-800/70 bg-slate-950/70 p-6 shadow-[0_20px_70px_-60px_rgba(15,23,42,0.9)] sm:flex-row"
              >
                <div className="relative h-56 w-full flex-shrink-0 overflow-hidden rounded-2xl sm:h-48 sm:w-40">
                  <PosterImage
                    src={item.movie.posterUrl}
                    fallbackSrc={item.movie.fallbackPosterUrl ?? null}
                    alt={item.movie.title}
                    sizes="(max-width: 640px) 100vw, 160px"
                    tmdbId={item.movie.tmdbId}
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-800/70 bg-slate-900/70 text-sm text-indigo-200">
                      {item.position + 1}
                    </span>
                    <div>
                      <h2 className="text-xl font-semibold text-slate-100">{item.movie.title}</h2>
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{item.movie.releaseYear ?? ""}</p>
                    </div>
                  </div>
                  {item.movie.overview ? <p className="text-sm text-slate-300">{item.movie.overview}</p> : null}
                  {item.note ? (
                    <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4 text-sm text-slate-200">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Curator note</p>
                      <p>{item.note}</p>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
            {mappedItems.length === 0 ? (
              <p className="rounded-3xl border border-dashed border-slate-800/70 bg-slate-950/60 p-12 text-center text-sm text-slate-400">
                This collection is warming up. Check back soon.
              </p>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
