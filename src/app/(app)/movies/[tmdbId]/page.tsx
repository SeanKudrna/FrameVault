"use client";

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { PosterImage } from "@/components/media/poster-image";
import { AddToCollectionForm } from "@/components/movies/add-to-collection-form";
import type { WatchProviderGroup, MovieDetail, CastMember, CrewMember } from "@/lib/tmdb";

type Review = {
  id: string;
  author: string;
  content: string;
  createdAt: string | null;
  rating: number | null;
  url: string | null;
};

function ReviewModal({ review, isOpen, onClose }: { review: Review | null; isOpen: boolean; onClose: () => void }) {
  if (!review) return null;

  const createdLabel = review.createdAt ? new Date(review.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }) : null;

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 focus:outline-none">
          <div className="glass-card rounded-3xl p-8 shadow-2xl max-h-[80vh] overflow-y-auto">
            <Dialog.Title className="text-xl font-bold text-gradient mb-4">
              Review by {review.author}
            </Dialog.Title>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-sm text-text-tertiary">
                <span className="font-medium text-text-primary">{review.author}</span>
                {createdLabel && <span>• {createdLabel}</span>}
                {typeof review.rating === "number" && <span>• {review.rating.toFixed(1)} / 10</span>}
              </div>

              <div className="prose prose-sm max-w-none text-text-secondary">
                <p className="whitespace-pre-wrap leading-relaxed">{review.content}</p>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <Dialog.Close asChild>
                <button className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
                  Close
                </button>
              </Dialog.Close>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ReviewsSection({ tmdbReviews }: { tmdbReviews: Review[] }) {
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);

  const openReviewModal = (review: Review) => {
    setSelectedReview(review);
    setIsModalOpen(true);
  };

  const closeReviewModal = () => {
    setIsModalOpen(false);
    setSelectedReview(null);
  };

  // Function to truncate review content to first few sentences
  const truncateReview = (content: string, maxSentences: number = 2): string => {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length <= maxSentences) return content;

    const truncated = sentences.slice(0, maxSentences).join('. ').trim();
    return truncated + (truncated.endsWith('.') ? '..' : '...');
  };

  const displayedReviews = showAllReviews ? tmdbReviews : tmdbReviews.slice(0, 6);

  return (
    <>
      <ReviewModal
        review={selectedReview}
        isOpen={isModalOpen}
        onClose={closeReviewModal}
      />

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">TMDB reviews</h3>
        {tmdbReviews.length ? (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {displayedReviews.map((review) => {
                const createdLabel = formatReviewDate(review.createdAt);
                const truncatedContent = truncateReview(review.content);
                return (
                  <article
                    key={review.id}
                    className="space-y-3 rounded-2xl border border-border-secondary/60 bg-surface-secondary/30 p-4 h-full flex flex-col"
                  >
                    <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.22em] text-text-tertiary">
                      <span>{review.author}</span>
                      {createdLabel ? <span>• {createdLabel}</span> : null}
                      {typeof review.rating === "number" ? <span>• {review.rating.toFixed(1)} / 10</span> : null}
                    </div>
                    <p className="text-sm leading-relaxed text-text-secondary flex-1">
                      {truncatedContent}
                    </p>
                    {review.url ? (
                      <button
                        onClick={() => openReviewModal(review)}
                        className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.22em] text-accent-secondary transition-colors hover:text-accent-primary cursor-pointer self-start"
                      >
                        Read full review
                      </button>
                    ) : null}
                  </article>
                );
              })}
            </div>

            {tmdbReviews.length > 6 && !showAllReviews && (
              <div className="text-center">
                <button
                  onClick={() => setShowAllReviews(true)}
                  className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer border border-border-secondary rounded-lg hover:bg-surface-secondary/50"
                >
                  Load more reviews ({tmdbReviews.length - 6} remaining)
                </button>
              </div>
            )}

            {showAllReviews && tmdbReviews.length > 6 && (
              <div className="text-center">
                <button
                  onClick={() => setShowAllReviews(false)}
                  className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer border border-border-secondary rounded-lg hover:bg-surface-secondary/50"
                >
                  Show less
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-border-secondary/70 bg-surface-secondary/30 p-4 text-sm text-text-secondary">
            TMDB hasn&apos;t published community reviews for this title yet.
          </div>
        )}
      </div>
    </>
  );
}


function formatReviewDate(timestamp: string | null) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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

export default function MovieDetailPage({
  params,
}: {
  params: Promise<{ tmdbId: string }>;
}) {
  const [movieData, setMovieData] = useState<{
    movie: MovieDetail;
    collections: { id: string; title: string }[];
    providers: WatchProviderGroup | null;
    cast: CastMember[];
    crew: CrewMember[];
    directors: CrewMember[];
    writers: CrewMember[];
    cinematographers: CrewMember[];
    producers: CrewMember[];
    editors: CrewMember[];
    productionDesigners: CrewMember[];
    composers: CrewMember[];
    tmdbReviews: Review[];
    runtimeFormatted: string | null;
    voteAverage: string | null;
    rationale: string[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const { tmdbId: tmdbIdParam } = await params;
        const tmdbId = Number(tmdbIdParam);
        if (!Number.isFinite(tmdbId)) {
          notFound();
        }

        const response = await fetch(`/api/movies/${tmdbId}`);
        if (!response.ok) {
          notFound();
        }

        const data = await response.json();

        setMovieData(data);
      } catch (error) {
        console.error("Error loading movie data:", error);
        notFound();
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [params]);

  if (loading || !movieData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-text-secondary">Loading...</div>
      </div>
    );
  }

  const {
    movie,
    collections,
    providers,
    cast,
    directors,
    writers,
    cinematographers,
    producers,
    editors,
    productionDesigners,
    composers,
    tmdbReviews,
    runtimeFormatted,
    voteAverage,
    rationale,
  } = movieData;

  return (
    <div className="space-y-10">
      <Link
        href="/app"
        className="inline-flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-text-primary"
      >
        ← Back to Dashboard
      </Link>

      <div className="space-y-6">
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

            <div className="flex-1">
              <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
                {/* Left column: Movie info */}
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.3em] text-text-tertiary">
                      <span>Smart Pick Spotlight</span>
                      {movie.releaseYear ? <span>• {movie.releaseYear}</span> : null}
                      {runtimeFormatted ? <span>• {runtimeFormatted}</span> : null}
                      {voteAverage ? <span>• {voteAverage} ★</span> : null}
                    </div>
                    <h1 className="text-3xl font-bold text-gradient md:text-4xl">{movie.title}</h1>
                  </div>

                  {movie.tagline ? (
                    <p className="text-lg font-medium italic text-accent-secondary/80">{movie.tagline}</p>
                  ) : null}

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

                {/* Right column: Key creatives */}
                <div className="space-y-6 h-full flex flex-col">
                  {directors.length || writers.length || cinematographers.length || producers.length || editors.length || productionDesigners.length || composers.length ? (
                    <div className="space-y-3 rounded-2xl border border-border-secondary/70 bg-surface-secondary/30 p-4 flex-1">
                      <h3 className="text-sm font-semibold text-gradient">Key creatives</h3>
                      <div className="space-y-2 text-sm text-text-secondary">
                        {directors.length ? (
                          <div>
                            <span className="font-semibold text-text-primary">Director{directors.length > 1 ? "s" : ""}:</span>
                            <span className="ml-2 text-text-secondary">{directors.map((person) => person.name).join(", ")}</span>
                          </div>
                        ) : null}
                        {cinematographers.length ? (
                          <div>
                            <span className="font-semibold text-text-primary">Cinematographer{cinematographers.length > 1 ? "s" : ""}:</span>
                            <span className="ml-2 text-text-secondary">{cinematographers.map((person) => person.name).join(", ")}</span>
                          </div>
                        ) : null}
                        {writers.length ? (
                          <div>
                            <span className="font-semibold text-text-primary">Writer{writers.length > 1 ? "s" : ""}:</span>
                            <span className="ml-2 text-text-secondary">{writers.map((person) => person.name).join(", ")}</span>
                          </div>
                        ) : null}
                        {producers.length ? (
                          <div>
                            <span className="font-semibold text-text-primary">Producer{producers.length > 1 ? "s" : ""}:</span>
                            <span className="ml-2 text-text-secondary">{producers.map((person) => person.name).join(", ")}</span>
                          </div>
                        ) : null}
                        {editors.length ? (
                          <div>
                            <span className="font-semibold text-text-primary">Editor{editors.length > 1 ? "s" : ""}:</span>
                            <span className="ml-2 text-text-secondary">{editors.map((person) => person.name).join(", ")}</span>
                          </div>
                        ) : null}
                        {productionDesigners.length ? (
                          <div>
                            <span className="font-semibold text-text-primary">Production Designer{productionDesigners.length > 1 ? "s" : ""}:</span>
                            <span className="ml-2 text-text-secondary">{productionDesigners.map((person) => person.name).join(", ")}</span>
                          </div>
                        ) : null}
                        {composers.length ? (
                          <div>
                            <span className="font-semibold text-text-primary">Composer{composers.length > 1 ? "s" : ""}:</span>
                            <span className="ml-2 text-text-secondary">{composers.map((person) => person.name).join(", ")}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Featured cast section below */}
        {cast.length ? (
          <div className="space-y-4 rounded-3xl border border-border-primary bg-surface-primary/70 p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gradient">Featured cast</h3>
            <div className="flex flex-wrap gap-6 justify-center">
              {cast.map((member) => (
                <div
                  key={member.id}
                  className="flex flex-col gap-0 overflow-hidden rounded-2xl border border-border-secondary/60 bg-surface-secondary/40 w-32 flex-shrink-0"
                >
                  <div className="relative h-20 w-full overflow-hidden rounded-t-2xl bg-surface-primary/60">
                    {member.profileUrl ? (
                      <Image
                        src={member.profileUrl}
                        alt={member.name}
                        width={128}
                        height={80}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-text-tertiary">
                        No photo
                      </div>
                    )}
                  </div>
                  <div className="p-4 space-y-1">
                    <p className="text-sm font-semibold text-text-primary">{member.name}</p>
                    {member.character ? (
                      <p className="text-xs uppercase tracking-[0.16em] text-text-tertiary">
                        {member.character}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <section className="space-y-8 rounded-3xl border border-border-primary bg-surface-primary/70 p-6 shadow-lg">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gradient">Why we picked this for you</h2>
            {rationale.length > 0 && (
              <div className="flex flex-wrap gap-y-1.5 gap-x-3">
                {rationale.map((reason, index) => (
                  <span
                    key={`rationale-${index}`}
                    className="rounded-full border border-accent-primary/30 bg-accent-primary/10 px-2 py-0.5 text-[10px] text-accent-primary/80"
                  >
                    {reason}
                  </span>
                ))}
              </div>
            )}
          </div>
          <p className="text-sm leading-relaxed text-text-secondary">
            Your viewing taste signals helped surface this title. Add it to a collection to track it, or just explore below to
            learn more.
          </p>
          {providers ? (
            <div className="space-y-6 rounded-2xl border border-border-secondary/70 bg-surface-secondary/40 p-4">
              <h3 className="text-sm font-semibold text-gradient">Where to watch</h3>
              <div className="space-y-4">
                <ProviderSection title="Streaming" providers={providers.stream} />
                <ProviderSection title="Rent" providers={providers.rent} />
                <ProviderSection title="Buy" providers={providers.buy} />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-border-secondary/70 bg-surface-secondary/40 p-4 text-sm text-text-tertiary">
              Streaming availability data is not available for this title.
            </div>
          )}


        </section>

        <aside className="space-y-4 rounded-3xl border border-border-primary bg-surface-primary/70 p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-gradient">Add to a collection</h2>
          <AddToCollectionForm collections={collections} movie={movie} />
        </aside>
      </div>

      <div className="space-y-8 rounded-3xl border border-border-primary bg-surface-primary/70 p-6 shadow-lg mb-[78px]">
        <h2 className="text-lg font-semibold text-gradient">Reviews</h2>

        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-text-primary">FrameVault reviews</h3>
            <div className="rounded-2xl border border-dashed border-border-secondary/70 bg-surface-secondary/30 p-4 text-sm text-text-secondary">
              Reviews from the FrameVault community are coming soon. You&apos;ll be able to rate and journal your thoughts right here.
            </div>
          </div>

          <ReviewsSection tmdbReviews={tmdbReviews} />
        </div>
      </div>
    </div>
  );
}
