import type { Collection, CollectionItem, Movie, Profile } from "@/lib/supabase/types";
import type { MovieSummary } from "@/lib/tmdb";

/**
 * Collection enriched with owner details and preloaded items for dashboard views.
 */
export interface CollectionWithItems extends Collection {
  owner: Pick<Profile, "id" | "username" | "display_name">;
  items: CollectionItemWithMovie[];
}

/**
 * Collection item that includes cached TMDB metadata when available.
 */
export interface CollectionItemWithMovie extends CollectionItem {
  movie: MovieSummary | (Movie & { overview?: string | null; vote_average?: number | null }) | null;
}
