
import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Movie } from "@/lib/supabase/types";

interface PageProps {
  params: Promise<{ username: string; collectionSlug: string }> | { username: string; collectionSlug: string };
  searchParams: { id?: string } | Promise<{ id?: string }>;
}

export default async function PublicCollectionPage({ params, searchParams }: PageProps) {
  const { username, collectionSlug } = await params;
  const query = await searchParams;
  const supabase = await getSupabaseServerClient();

  const usernameLower = username.toLowerCase();
  const profileResponse = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .filter("lower(username)", "eq", usernameLower)
    .maybeSingle();

  if (profileResponse.error) throw profileResponse.error;
  const profile = profileResponse.data;
  if (!profile) {
    notFound();
  }

  const collectionResponse = await supabase
    .from("collections")
    .select(
      "id, title, slug, description, previous_slugs, is_public, updated_at, collection_items(position, note, tmdb_id)"
    )
    .eq("owner_id", profile.id)
    .eq("slug", collectionSlug.toLowerCase())
    .maybeSingle();

  if (collectionResponse.error) throw collectionResponse.error;
  const collection = collectionResponse.data;

  if (!collection) {
    const historic = await supabase
      .from("collections")
      .select("id, slug")
      .eq("owner_id", profile.id)
      .contains("previous_slugs", [collectionSlug.toLowerCase()])
      .maybeSingle();

    if (historic.data) {
      redirect(`/c/${profile.username}/${historic.data.slug}`);
    }

    if (query?.id) {
      const byId = await supabase
        .from("collections")
        .select("slug")
        .eq("owner_id", profile.id)
        .eq("id", query.id)
        .maybeSingle();
      if (byId.data) {
        redirect(`/c/${profile.username}/${byId.data.slug}`);
      }
    }

    notFound();
  }

  if (!collection.is_public) {
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

  const mappedItems = items
    .map((item) => {
      const movie = moviesMap.get(item.tmdb_id) ?? null;
      const overview =
        movie?.tmdb_json && typeof movie.tmdb_json === "object" && "overview" in movie.tmdb_json
          ? (movie.tmdb_json as Record<string, unknown>)["overview"]
          : null;
      return {
        id: `${collection.id}-${item.position}`,
        position: item.position,
        note: item.note,
        movie: {
          title: movie?.title ?? "Untitled",
          posterUrl: movie?.poster_url ?? null,
          releaseYear: movie?.release_year ?? null,
          overview: (overview as string | null) ?? null,
        },
      };
    })
    .sort((a, b) => a.position - b.position);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-16">
      <header className="space-y-4 text-center">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Curated by {profile.display_name ?? profile.username}</p>
        <h1 className="text-4xl font-semibold text-slate-100">{collection.title}</h1>
        {collection.description ? <p className="text-sm text-slate-300">{collection.description}</p> : null}
        <p className="text-xs text-slate-500">Last updated {new Date(collection.updated_at).toLocaleDateString()}</p>
      </header>

      <section className="space-y-6">
        {mappedItems.map((item) => (
          <article
            key={item.id}
            className="flex flex-col gap-4 rounded-3xl border border-slate-800/70 bg-slate-950/70 p-6 shadow-[0_20px_70px_-60px_rgba(15,23,42,0.9)] sm:flex-row"
          >
            <div className="relative h-48 w-full flex-shrink-0 overflow-hidden rounded-2xl sm:w-40">
              {item.movie.posterUrl ? (
                <Image src={item.movie.posterUrl} alt={item.movie.title} fill className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center bg-slate-900/70 text-xs text-slate-500">
                  No art
                </div>
              )}
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
          <p className="text-center text-sm text-slate-400">This collection is warming up. Check back soon.</p>
        ) : null}
      </section>
    </div>
  );
}
