"use client";

import Image from "next/image";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MovieSummary } from "@/lib/tmdb";

interface MovieSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (movie: MovieSummary) => void;
  existingTmdbIds: number[];
}

export function MovieSearchModal({ open, onOpenChange, onSelect, existingTmdbIds }: MovieSearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MovieSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 h-[80vh] w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 space-y-6 overflow-hidden rounded-3xl border border-slate-800/60 bg-slate-950/80 p-6 shadow-2xl">
          <Dialog.Title className="text-2xl font-semibold text-slate-50">Search TMDB</Dialog.Title>
          <form onSubmit={handleSearch} className="flex gap-3">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search for a film..."
              className="h-12 text-base"
            />
            <Button type="submit" size="lg" disabled={loading}>
              <Search size={18} />
              {loading ? "Searching..." : "Search"}
            </Button>
          </form>
          {error ? <p className="text-sm text-rose-400">{error}</p> : null}
          <div className="h-full overflow-y-auto pr-2">
            <div className="grid gap-4 sm:grid-cols-2">
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
                    className="group flex items-center gap-4 rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4 text-left transition hover:border-indigo-400/60 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="relative h-20 w-14 overflow-hidden rounded-xl">
                      {movie.posterUrl ? (
                        <Image
                          src={movie.posterUrl}
                          alt={movie.title}
                          fill
                          sizes="80px"
                          className="object-cover transition duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-slate-800/60 text-xs text-slate-500">
                          No art
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-slate-100">{movie.title}</p>
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                        {movie.releaseYear ?? ""}
                      </p>
                      {movie.overview ? (
                        <p className="text-xs text-slate-400">{movie.overview}</p>
                      ) : null}
                    </div>
                  </button>
                );
              })}
              {results.length === 0 && !loading ? (
                <p className="col-span-2 text-center text-sm text-slate-500">Search for a title to add to this collection.</p>
              ) : null}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
