export type Plan = "free" | "plus" | "pro";

export type WatchStatus = "watched" | "watching" | "want";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          plan: Plan;
          stripe_customer_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          plan?: Plan;
          stripe_customer_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          username?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          plan?: Plan;
          stripe_customer_id?: string | null;
          updated_at?: string;
        };
      };
      collections: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          slug: string;
          previous_slugs: string[];
          description: string | null;
          theme: Record<string, unknown> | null;
          cover_image_url: string | null;
          is_public: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          title: string;
          slug: string;
          previous_slugs?: string[];
          description?: string | null;
          theme?: Record<string, unknown> | null;
          cover_image_url?: string | null;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          slug?: string;
          previous_slugs?: string[];
          description?: string | null;
          theme?: Record<string, unknown> | null;
          cover_image_url?: string | null;
          is_public?: boolean;
          updated_at?: string;
        };
      };
      collection_items: {
        Row: {
          id: string;
          collection_id: string;
          tmdb_id: number;
          position: number;
          note: string | null;
          rating: number | null;
          added_at: string;
        };
        Insert: {
          id?: string;
          collection_id: string;
          tmdb_id: number;
          position: number;
          note?: string | null;
          rating?: number | null;
          added_at?: string;
        };
        Update: {
          position?: number;
          note?: string | null;
          rating?: number | null;
        };
      };
      movies: {
        Row: {
          tmdb_id: number;
          title: string | null;
          release_year: number | null;
          poster_url: string | null;
          backdrop_url: string | null;
          genres: Record<string, unknown>[] | null;
          runtime: number | null;
          tmdb_json: Record<string, unknown> | null;
          updated_at: string;
        };
        Insert: {
          tmdb_id: number;
          title?: string | null;
          release_year?: number | null;
          poster_url?: string | null;
          backdrop_url?: string | null;
          genres?: Record<string, unknown>[] | null;
          runtime?: number | null;
          tmdb_json?: Record<string, unknown> | null;
          updated_at?: string;
        };
        Update: {
          title?: string | null;
          release_year?: number | null;
          poster_url?: string | null;
          backdrop_url?: string | null;
          genres?: Record<string, unknown>[] | null;
          runtime?: number | null;
          tmdb_json?: Record<string, unknown> | null;
          updated_at?: string;
        };
      };
      view_logs: {
        Row: {
          id: string;
          user_id: string;
          tmdb_id: number;
          status: WatchStatus;
          watched_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tmdb_id: number;
          status: WatchStatus;
          watched_at?: string | null;
          created_at?: string;
        };
        Update: {
          status?: WatchStatus;
          watched_at?: string | null;
        };
      };
      comments: {
        Row: {
          id: string;
          collection_id: string;
          user_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          collection_id: string;
          user_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          content?: string;
        };
      };
      follows: {
        Row: {
          follower_id: string;
          followee_id: string;
          created_at: string;
        };
        Insert: {
          follower_id: string;
          followee_id: string;
          created_at?: string;
        };
        Update: Record<string, never>;
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          plan: Plan;
          status: string;
          current_period_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          plan: Plan;
          status: string;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          plan?: Plan;
          status?: string;
          current_period_end?: string | null;
          updated_at?: string;
        };
      };
      tmdb_rate_limit: {
        Row: {
          id: number;
          actor: string | null;
          actor_type: "user" | "ip";
          bucket: string;
          window_start: string;
          window_end: string;
          request_count: number;
          inserted_at: string;
        };
        Insert: {
          id?: number;
          actor?: string | null;
          actor_type: "user" | "ip";
          bucket: string;
          window_start: string;
          window_end: string;
          request_count?: number;
          inserted_at?: string;
        };
        Update: {
          request_count?: number;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      watch_status: WatchStatus;
    };
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Collection = Database["public"]["Tables"]["collections"]["Row"];
export type CollectionItem = Database["public"]["Tables"]["collection_items"]["Row"];
export type Movie = Database["public"]["Tables"]["movies"]["Row"];
