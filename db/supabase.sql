-- FrameVault Day 1 schema

-- Extensions
create extension if not exists pgcrypto; -- gen_random_uuid

-- Helper function for timestamps
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Storage bucket for collection covers
insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values (
  'covers',
  'covers',
  true,
  array['image/jpeg', 'image/png', 'image/webp'],
  5 * 1024 * 1024
)
on conflict (id) do update
set
  public = excluded.public,
  allowed_mime_types = excluded.allowed_mime_types,
  file_size_limit = excluded.file_size_limit;

-- Profiles table mirrors auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  display_name text,
  avatar_url text,
  plan text not null default 'free', -- free | plus | pro
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_profiles_username_ci on public.profiles (lower(username));

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Collections - primary content surface
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  slug text not null,
  previous_slugs text[] not null default array[]::text[],
  description text,
  theme jsonb,
  cover_image_url text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_collections_owner_slug on public.collections(owner_id, slug);
create index if not exists idx_collections_owner on public.collections(owner_id);
create index if not exists idx_collections_public_slug on public.collections(slug) where is_public;

drop trigger if exists set_collections_updated_at on public.collections;
create trigger set_collections_updated_at
before update on public.collections
for each row execute function public.set_updated_at();

-- Maintain slug history on change
create or replace function public.collections_slug_history()
returns trigger
language plpgsql
as $$
begin
  if new.slug <> old.slug then
    if not (old.slug = any(old.previous_slugs)) then
      new.previous_slugs := array_prepend(old.slug, old.previous_slugs);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists collections_slug_history on public.collections;
create trigger collections_slug_history
before update of slug on public.collections
for each row
when (old.slug is distinct from new.slug)
execute function public.collections_slug_history();

-- Ensure slug stored lower case
create or replace function public.slug_lowercase()
returns trigger
language plpgsql
as $$
begin
  new.slug := lower(new.slug);
  return new;
end;
$$;

drop trigger if exists collections_slug_lowercase on public.collections;
create trigger collections_slug_lowercase
before insert or update of slug on public.collections
for each row execute function public.slug_lowercase();

-- Collection items (movies within a collection)
create table if not exists public.collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  tmdb_id bigint not null,
  position integer not null,
  note text,
  rating numeric(3,1),
  added_at timestamptz not null default now(),
  unique (collection_id, tmdb_id)
);

create index if not exists idx_collection_items_collection on public.collection_items(collection_id);
create index if not exists idx_collection_items_position on public.collection_items(collection_id, position);
create index if not exists idx_collection_items_tmdb on public.collection_items(tmdb_id);

-- Cached TMDB movie metadata
create table if not exists public.movies (
  tmdb_id bigint primary key,
  title text,
  release_year integer,
  poster_url text,
  backdrop_url text,
  genres jsonb,
  runtime integer,
  tmdb_json jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.set_movies_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_movies_updated_at on public.movies;
create trigger set_movies_updated_at
before update on public.movies
for each row execute function public.set_movies_updated_at();

-- View logs for watch tracking (prepped for Day 2+)
do $$
begin
  create type public.watch_status as enum ('watched', 'watching', 'want');
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.view_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tmdb_id bigint not null,
  status public.watch_status not null,
  watched_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, tmdb_id)
);

create index if not exists idx_view_logs_user on public.view_logs(user_id);

-- Social primitives for later milestones
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_comments_collection on public.comments(collection_id);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text not null,
  status text not null,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, stripe_subscription_id)
);

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

-- Track processed Stripe webhook events for idempotency
create table if not exists public.stripe_webhook_events (
  id bigserial primary key,
  event_id text not null unique,
  event_type text not null,
  processed_at timestamptz not null default now()
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;
alter table public.movies enable row level security;
alter table public.view_logs enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;
alter table public.subscriptions enable row level security;
alter table public.stripe_webhook_events enable row level security;

-- RLS policies
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
for select using (true);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
for update using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists collections_owner_crud on public.collections;
create policy collections_owner_crud on public.collections
for all using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists collections_read_public on public.collections;
create policy collections_read_public on public.collections
for select using (is_public or auth.uid() = owner_id);

drop policy if exists collection_items_owner_crud on public.collection_items;
create policy collection_items_owner_crud on public.collection_items
for all using (
  exists (
    select 1 from public.collections c
    where c.id = collection_id and c.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.collections c
    where c.id = collection_id and c.owner_id = auth.uid()
  )
);

drop policy if exists movies_read on public.movies;
create policy movies_read on public.movies
for select using (true);

drop policy if exists movies_service_upsert on public.movies;
create policy movies_service_upsert on public.movies
for all using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists view_logs_owner_crud on public.view_logs;
create policy view_logs_owner_crud on public.view_logs
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments
for select using (
  exists (
    select 1
    from public.collections c
    where c.id = collection_id and (c.is_public or c.owner_id = auth.uid())
  )
);

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
for insert with check (auth.role() = 'authenticated');

drop policy if exists follows_owner_crud on public.follows;
create policy follows_owner_crud on public.follows
for all using (auth.uid() = follower_id)
with check (auth.uid() = follower_id);

drop policy if exists subscriptions_owner_rw on public.subscriptions;
create policy subscriptions_owner_rw on public.subscriptions
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists stripe_webhook_events_service on public.stripe_webhook_events;
create policy stripe_webhook_events_service on public.stripe_webhook_events
for all using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

-- Utility view for rate limiting logs (app managed)
create table if not exists public.tmdb_rate_limit (
  id bigserial primary key,
  actor text,
  actor_type text not null, -- user | ip
  bucket text not null, -- search | movie | export
  window_start timestamptz not null,
  window_end timestamptz not null,
  request_count integer not null default 0,
  inserted_at timestamptz not null default now()
);

alter table public.tmdb_rate_limit enable row level security;
drop policy if exists tmdb_rate_limit_service on public.tmdb_rate_limit;
create policy tmdb_rate_limit_service on public.tmdb_rate_limit
for all using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
