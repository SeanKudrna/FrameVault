import type { Collection, CollectionItem, Movie, Profile } from "@/lib/supabase/types";
import type { MovieSummary } from "@/lib/tmdb";

export interface CollectionWithItems extends Collection {
  owner: Pick<Profile, "id" | "username" | "display_name">;
  items: CollectionItemWithMovie[];
}

export interface CollectionItemWithMovie extends CollectionItem {
  movie: MovieSummary | (Movie & { overview?: string | null; vote_average?: number | null }) | null;
}
