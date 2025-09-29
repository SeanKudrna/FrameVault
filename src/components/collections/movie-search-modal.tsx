"use client";

/**
 * Modal for searching TMDB and selecting a movie to add to a collection. All
 * data fetching happens client-side against our proxied API routes.
 */

import Image from "next/image";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { MovieSummary } from "@/lib/tmdb";

/**
 * Props controlling the TMDB movie search modal.
 */
interface MovieSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (movie: MovieSummary) => void;
  existingTmdbIds: number[];
}

/**
 * Modal dialog that lets users search TMDB and add movies to a collection.
 */
export function MovieSearchModal({ open, onOpenChange, onSelect, existingTmdbIds }: MovieSearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MovieSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Queries the TMDB search API and stores the resulting list of movies. Results
   * are filtered client-side to prevent selecting duplicates.
   */
  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.trim().length < 2) {
      setError("Enter at least two characters to search");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/tmdb/search?query=${encodeURIComponent(query.trim())}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Search failed");
      }
      const payload = (await response.json()) as { results: MovieSummary[] };
      setResults(payload.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 h-[80vh] w-full max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-border-primary bg-surface-primary/90 p-8 shadow-2xl">
          <div className="flex flex-col h-full space-y-8">
            {/* Header */}
            <div className="text-center space-y-2">
              <Dialog.Title className="text-3xl font-bold text-gradient">Search & Add Movies</Dialog.Title>
              <p className="text-text-secondary">Find films from TMDB to add to your collection</p>
            </div>

            {/* Search Form */}
            <form onSubmit={handleSearch} className="flex items-center justify-center gap-3 w-full max-w-md mx-auto">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search for a film..."
                className="h-11 text-base flex-1"
              />
              <Button
                type="submit"
                disabled={loading}
                className="flex h-11 w-11 items-center justify-center rounded-full p-0"
                title={loading ? "Searching..." : "Search"}
              >
                <Search size={16} />
              </Button>
            </form>

            {error ? <p className="text-sm text-red-400 text-center">{error}</p> : null}

            {/* Results */}
            <div className="flex-1 overflow-y-auto">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((movie) => {
                  const alreadyAdded = existingTmdbIds.includes(movie.tmdbId);
                  return (
                    <button
                      key={movie.tmdbId}
                      type="button"
                      disabled={alreadyAdded}
                      onClick={() => {
                        onSelect(movie);
                        onOpenChange(false);
                      }}
                      className={cn(
                        "group flex flex-col gap-4 rounded-3xl border border-border-primary/60 bg-surface-primary/80 p-4 text-left transition-all duration-200 hover:-translate-y-1 hover:border-accent-primary/50 hover:shadow-lg hover:shadow-accent-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
                        alreadyAdded && "opacity-40"
                      )}
                    >
                      {/* Poster */}
                      <div className="relative h-32 w-full overflow-hidden rounded-2xl border border-border-secondary/60 bg-surface-secondary">
                        {movie.posterUrl ? (
                          <Image
                            src={movie.posterUrl}
                            alt={movie.title}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-surface-secondary text-xs text-text-tertiary">
                            No poster
                          </div>
                        )}
                        {alreadyAdded && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                            <span className="text-xs font-medium text-white uppercase tracking-wide">Already added</span>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 space-y-3">
                        <div className="space-y-1">
                          <h3 className="font-semibold text-text-primary line-clamp-2 leading-tight">
                            {movie.title}
                            {movie.releaseYear && (
                              <span className="text-sm font-normal text-text-tertiary ml-2">
                                ({movie.releaseYear})
                              </span>
                            )}
                          </h3>
                        </div>

                        {movie.overview && (
                          <p className="text-sm text-text-secondary line-clamp-3 leading-relaxed">
                            {movie.overview}
                          </p>
                        )}

                        {/* Add Button */}
                        <div className="pt-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs uppercase tracking-wide text-text-tertiary">
                              Add to collection
                            </span>
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-primary/10 border border-accent-primary/20 text-accent-primary transition-colors group-hover:bg-accent-primary group-hover:text-white">
                              <Plus size={14} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
                {results.length === 0 && !loading ? (
                  <div className="col-span-full flex flex-col items-center justify-center py-12 text-center space-y-2">
                    <Search size={48} className="text-text-tertiary/50" />
                    <p className="text-text-tertiary">Search for a title to add to this collection</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
