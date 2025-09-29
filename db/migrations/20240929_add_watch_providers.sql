-- Add watch_providers column to movies table if it doesn't exist
-- This migration ensures streaming availability data can be cached

alter table public.movies
  add column if not exists watch_providers jsonb;

-- Add comment for documentation
comment on column public.movies.watch_providers is 'Cached TMDB watch providers data for streaming availability';
