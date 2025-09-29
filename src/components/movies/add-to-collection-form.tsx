"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { addMovieToCollectionAction } from "@/app/(app)/collections/actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/providers/toast-provider";
import type { MovieSummary } from "@/lib/tmdb";

interface CollectionOption {
  id: string;
  title: string;
}

interface AddToCollectionFormProps {
  collections: CollectionOption[];
  movie: MovieSummary;
}

export function AddToCollectionForm({ collections, movie }: AddToCollectionFormProps) {
  const { toast } = useToast();
  const [selectedCollection, setSelectedCollection] = useState(collections[0]?.id ?? "");
  const [pending, startTransition] = useTransition();

  const selectOptions = collections.map(collection => ({
    value: collection.id,
    label: collection.title,
  }));

  if (collections.length === 0) {
    return (
      <div className="space-y-4 text-sm text-text-secondary">
        <p>You haven&apos;t created any collections yet.</p>
        <Link
          href="/app"
          className="inline-flex items-center gap-2 rounded-full border border-border-secondary px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-accent-secondary transition-colors hover:border-accent-secondary hover:text-accent-primary"
        >
          Create a collection
        </Link>
      </div>
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCollection) {
      toast({
        title: "Select a collection",
        description: "Choose a collection before adding this movie.",
        variant: "info",
      });
      return;
    }

    startTransition(async () => {
      try {
        await addMovieToCollectionAction({
          collectionId: selectedCollection,
          movie: {
            tmdbId: movie.tmdbId,
            title: movie.title,
            releaseYear: movie.releaseYear,
            posterUrl: movie.posterUrl ?? movie.fallbackPosterUrl ?? null,
            backdropUrl: movie.backdropUrl,
            overview: movie.overview,
            runtime: movie.runtime,
            genres: movie.genres,
          },
        });
        toast({
          title: "Movie added",
          description: `Added "${movie.title}" to your collection.`,
          variant: "success",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to add this movie right now";
        toast({ title: "Unable to add movie", description: message, variant: "error" });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-[0.22em] text-text-tertiary">
          Choose collection
        </label>
        <Select
          value={selectedCollection}
          onValueChange={setSelectedCollection}
          options={selectOptions}
          placeholder="Choose a collection"
        />
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Adding..." : "Add to collection"}
      </Button>
    </form>
  );
}
