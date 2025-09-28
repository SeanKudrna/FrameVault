import { notFound } from "next/navigation";
import Link from "next/link";
import { PosterImage } from "@/components/media/poster-image";
import { AddToCollectionForm } from "@/components/movies/add-to-collection-form";
import { fetchWatchProviders, getMovieSummaryById } from "@/lib/tmdb";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { WatchProviderGroup } from "@/lib/tmdb";

function formatRuntime(runtime: number | null) {
  if (!runtime || runtime <= 0) return null;
  const hours = Math.floor(runtime / 60);
  const minutes = runtime % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

function ProviderSection({ title, providers }: { title: string; providers: WatchProviderGroup["stream"] }) {
  if (!providers.length) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-text-tertiary">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {providers.map((provider) => (
          <span
            key={`${title}-${provider.id}`}
            className="flex items-center gap-2 rounded-full border border-border-secondary bg-surface-secondary/60 px-3 py-1 text-xs text-text-secondary"
          >
            {provider.logoUrl ? (
              <span className="relative h-4 w-4 overflow-hidden rounded-full bg-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={provider.logoUrl} alt={provider.name} className="h-full w-full object-contain" />
              </span>
            ) : null}
            {provider.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export default async function MovieDetailPage({
  params,
}: {
  params: Promise<{ tmdbId: string }>;
}) {
  const { tmdbId: tmdbIdParam } = await params;
  const tmdbId = Number(tmdbIdParam);
  if (!Number.isFinite(tmdbId)) {
    notFound();
  }

  const movie = await getMovieSummaryById(tmdbId);
  if (!movie) {
    notFound();
  }

  const supabase = await getSupabaseServerClient();
  const [{ data: userData }] = await Promise.all([
    supabase.auth.getUser(),
  ]);
  const user = userData?.user;
  if (!user) {
    notFound();
  }

  const { data: collectionsData, error: collectionsError } = await supabase
    .from("collections")
    .select("id, title, slug")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });
  if (collectionsError) {
    throw collectionsError;
  }
  const collections = (collectionsData ?? []).map((collection) => ({
    id: collection.id,
    title: collection.title,
  }));

  const providers = await fetchWatchProviders(tmdbId).catch(() => null);
  const runtimeFormatted = formatRuntime(movie.runtime);
  const voteAverage = typeof movie.voteAverage === "number" && movie.voteAverage > 0 ? movie.voteAverage.toFixed(1) : null;

  return (
    <div className="space-y-10">
      <Link
        href="/app"
        className="inline-flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-text-primary"
      >
        ← Back to Dashboard
      </Link>

      <div className="relative overflow-hidden rounded-3xl border border-border-primary bg-surface-primary/70 shadow-xl">
        {movie.backdropUrl ? (
          <div
            className="absolute inset-0 -z-10 bg-cover bg-center opacity-20"
            style={{ backgroundImage: `url(${movie.backdropUrl})` }}
            aria-hidden="true"
          />
        ) : null}
        <div className="flex flex-col gap-10 p-6 md:p-10 lg:flex-row">
          <div className="mx-auto w-full max-w-[220px] overflow-hidden rounded-3xl border border-border-secondary bg-surface-secondary/80 shadow-lg">
            <div className="relative aspect-[2/3]">
              <PosterImage
                src={movie.posterUrl ?? movie.fallbackPosterUrl ?? null}
                fallbackSrc={movie.fallbackPosterUrl ?? null}
                alt={movie.title}
                tmdbId={movie.tmdbId}
                sizes="(min-width: 1280px) 220px, 60vw"
              />
            </div>
          </div>

          <div className="flex-1 space-y-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.3em] text-text-tertiary">
                <span>Smart Pick Spotlight</span>
                {movie.releaseYear ? <span>• {movie.releaseYear}</span> : null}
                {runtimeFormatted ? <span>• {runtimeFormatted}</span> : null}
                {voteAverage ? <span>• {voteAverage} ★</span> : null}
              </div>
              <h1 className="text-3xl font-bold text-gradient md:text-4xl">{movie.title}</h1>
            </div>

            {movie.overview ? (
              <p className="max-w-3xl text-base leading-relaxed text-text-secondary">{movie.overview}</p>
            ) : null}

            {movie.genres.length ? (
              <div className="flex flex-wrap gap-2">
                {movie.genres.map((genre) => (
                  <span
                    key={genre.id}
                    className="rounded-full border border-border-secondary bg-surface-secondary/80 px-3 py-1 text-xs font-medium text-text-secondary"
                  >
                    {genre.name}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-4 text-sm text-text-tertiary">
              <a
                href={`https://www.themoviedb.org/movie/${movie.tmdbId}`}
                className="rounded-full border border-border-secondary px-4 py-1 transition-colors hover:border-accent-primary hover:text-accent-primary"
                target="_blank"
                rel="noreferrer"
              >
                View on TMDB
              </a>
              {providers?.link ? (
                <a
                  href={providers.link}
                  className="rounded-full border border-border-secondary px-4 py-1 transition-colors hover:border-accent-secondary hover:text-accent-secondary"
                  target="_blank"
                  rel="noreferrer"
                >
                  Watch Options ({providers.region})
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <section className="space-y-6 rounded-3xl border border-border-primary bg-surface-primary/70 p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-text-primary">Why we picked this for you</h2>
          <p className="text-sm leading-relaxed text-text-secondary">
            Your viewing taste signals helped surface this title. Add it to a collection to track it, or just explore below to
            learn more.
          </p>
          {providers ? (
            <div className="space-y-6 rounded-2xl border border-border-secondary/70 bg-surface-secondary/40 p-4">
              <h3 className="text-sm font-semibold text-text-primary">Where to watch</h3>
              <div className="space-y-4">
                <ProviderSection title="Streaming" providers={providers.stream} />
                <ProviderSection title="Rent" providers={providers.rent} />
                <ProviderSection title="Buy" providers={providers.buy} />
              </div>
              {providers.availableRegions.length ? (
                <p className="text-xs text-text-tertiary">
                  Available regions: {providers.availableRegions.join(", ")}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-border-secondary/70 bg-surface-secondary/40 p-4 text-sm text-text-tertiary">
              Availability data is loading. Refresh in a bit for streaming links.
            </div>
          )}
        </section>

        <aside className="space-y-4 rounded-3xl border border-border-primary bg-surface-primary/70 p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-text-primary">Add to a collection</h2>
          <AddToCollectionForm collections={collections} movie={movie} />
        </aside>
      </div>
    </div>
  );
}
