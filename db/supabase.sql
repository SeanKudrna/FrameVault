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
  plan_expires_at timestamptz,
  next_plan text,
  plan_source text not null default 'manual',
  preferred_region text not null default 'US',
  onboarding_state jsonb not null default '{"claimedProfile": false, "createdFirstCollection": false, "addedFiveMovies": false, "completed": false}'::jsonb,
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists preferred_region text;

alter table public.profiles
  alter column preferred_region set data type text,
  alter column preferred_region set default 'US',
  alter column preferred_region set not null;

update public.profiles
set preferred_region = 'US'
where preferred_region is null;

alter table public.profiles
  add column if not exists onboarding_state jsonb;

alter table public.profiles
  alter column onboarding_state set data type jsonb,
  alter column onboarding_state set default '{"claimedProfile": false, "createdFirstCollection": false, "addedFiveMovies": false, "completed": false}'::jsonb,
  alter column onboarding_state set not null;

update public.profiles
set onboarding_state = '{"claimedProfile": false, "createdFirstCollection": false, "addedFiveMovies": false, "completed": false}'::jsonb
where onboarding_state is null;

alter table public.profiles
  add column if not exists plan_expires_at timestamptz;

alter table public.profiles
  add column if not exists next_plan text;

alter table public.profiles
  add column if not exists plan_source text;

alter table public.profiles
  alter column plan_source set data type text,
  alter column plan_source set default 'manual',
  alter column plan_source set not null;

update public.profiles
set plan_source = coalesce(plan_source, 'manual')
where plan_source is null;

update public.profiles
set next_plan = null
where next_plan is not null and next_plan not in ('free', 'plus', 'pro');

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
create index if not exists idx_collections_public_updated_at on public.collections(is_public, updated_at desc);

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

-- Synchronises profile plan columns with the latest subscription metadata.
create or replace function public.apply_subscription_change(target_user uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  subscription_row public.subscriptions%rowtype;
  profile_row public.profiles%rowtype;
  effective_plan text;
  scheduled_plan text;
  profile_exists boolean := false;
  subscription_exists boolean := false;
begin
  if target_user is null then
    return null;
  end if;

  select *
    into subscription_row
  from public.subscriptions
  where user_id = target_user
    and is_current
  order by updated_at desc, created_at desc
  limit 1;
  subscription_exists := found;

  select * into profile_row from public.profiles where id = target_user;
  profile_exists := found;

  if not profile_exists then
    return null;
  end if;

  if not subscription_exists then
    update public.profiles p
    set
      plan = 'free',
      plan_source = 'manual',
      plan_expires_at = null,
      next_plan = null
    where p.id = target_user
    returning * into profile_row;
  elsif subscription_row.ended_at is not null and subscription_row.ended_at <= now() then
    update public.profiles p
    set
      plan = 'free',
      plan_source = 'subscription',
      plan_expires_at = null,
      next_plan = null
    where p.id = target_user
    returning * into profile_row;
  elsif subscription_row.status in ('active', 'trialing', 'past_due', 'unpaid', 'incomplete') then
    effective_plan := subscription_row.plan;
    if effective_plan is null or effective_plan not in ('free', 'plus', 'pro') then
      effective_plan := 'free';
    end if;

    scheduled_plan := null;
    if subscription_row.pending_plan is not null
       and subscription_row.pending_plan in ('free', 'plus', 'pro')
       and subscription_row.pending_plan <> effective_plan then
      scheduled_plan := subscription_row.pending_plan;
    elsif coalesce(subscription_row.cancel_at_period_end, false) then
      scheduled_plan := 'free';
    end if;

    if scheduled_plan is not null
       and subscription_row.current_period_end is not null
       and subscription_row.current_period_end <= now() then
      effective_plan := scheduled_plan;
      scheduled_plan := null;
    end if;

    update public.profiles p
    set
      plan = effective_plan,
      plan_source = 'subscription',
      plan_expires_at = case
        when scheduled_plan is not null and subscription_row.current_period_end is not null
          then subscription_row.current_period_end
        else null
      end,
      next_plan = case
        when scheduled_plan is not null then scheduled_plan
        else null
      end
    where p.id = target_user
    returning * into profile_row;
  else
    update public.profiles p
    set
      plan = 'free',
      plan_source = 'subscription',
      plan_expires_at = null,
      next_plan = null
    where p.id = target_user
    returning * into profile_row;
  end if;

  if profile_row.id is null then
    select * into profile_row from public.profiles where id = target_user;
  end if;

  return profile_row;
end;
$$;

-- Computes the effective plan for a user and applies deferred downgrades when expired.
create or replace function public.compute_effective_plan(target_user uuid)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  profile_row public.profiles%rowtype;
  desired_plan text;
begin
  if target_user is null then
    return 'free';
  end if;

  select *
    into profile_row
  from public.profiles
  where id = target_user
  for update;

  if not found then
    return 'free';
  end if;

  if profile_row.plan_expires_at is not null and profile_row.plan_expires_at <= now() then
    desired_plan := coalesce(profile_row.next_plan, 'free');
    update public.profiles p
    set
      plan = desired_plan,
      plan_expires_at = null,
      next_plan = null,
      plan_source = case
        when p.plan_source = 'subscription' then p.plan_source
        else 'system'
      end
    where p.id = target_user
    returning p.plan into desired_plan;

    return desired_plan;
  end if;

  return profile_row.plan;
end;
$$;

-- Convenience wrapper that derives the target user from the authenticated context.
create or replace function public.compute_effective_plan_self()
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_user uuid;
begin
  target_user := auth.uid();
  if target_user is null then
    return 'free';
  end if;

  return public.compute_effective_plan(target_user);
end;
$$;

-- Sweeps and expires any profiles whose plan grace period has elapsed.
create or replace function public.expire_lapsed_plans(batch_size integer default 100)
returns table (user_id uuid, previous_plan text, new_plan text)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  return query
  with candidates as (
    select id, plan as previous_plan, coalesce(next_plan, 'free') as target_plan
    from public.profiles
    where plan_expires_at is not null
      and plan_expires_at <= now()
    order by plan_expires_at
    limit greatest(batch_size, 0)
  ),
  updated as (
    update public.profiles p
    set
      plan = c.target_plan,
      plan_expires_at = null,
      next_plan = null,
      plan_source = case
        when p.plan_source = 'subscription' then p.plan_source
        else 'system'
      end
    from candidates c
    where p.id = c.id
    returning p.id as user_id, c.previous_plan, c.target_plan
  )
  select * from updated;
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

-- Collaborative editing support
create table if not exists public.collection_collaborators (
  collection_id uuid not null references public.collections(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'editor', -- owner | editor | viewer (viewer optional)
  created_at timestamptz not null default now(),
  primary key (collection_id, user_id)
);

create index if not exists idx_collection_collaborators_user on public.collection_collaborators(user_id);
create index if not exists idx_collection_collaborators_collection on public.collection_collaborators(collection_id);

alter table public.collection_collaborators
  add column if not exists owner_id uuid;

update public.collection_collaborators cc
set owner_id = c.owner_id
from public.collections c
where cc.collection_id = c.id and cc.owner_id is distinct from c.owner_id;

alter table public.collection_collaborators
  alter column owner_id set not null;

alter table public.collection_collaborators
  add constraint if not exists collection_collaborators_owner_fk
    foreign key (owner_id) references public.profiles(id) on delete cascade;

create index if not exists idx_collection_collaborators_owner on public.collection_collaborators(owner_id);

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
  watch_providers jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_movies_genres_gin on public.movies using gin(genres jsonb_path_ops);

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
create index if not exists idx_view_logs_user_status on public.view_logs(user_id, status);
create index if not exists idx_view_logs_tmdb on public.view_logs(tmdb_id);

-- Social primitives for later milestones
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id)
);

create index if not exists idx_follows_followee on public.follows(followee_id);
create index if not exists idx_follows_follower on public.follows(follower_id);

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
  provider text not null default 'stripe',
  subscription_id text,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text not null,
  status text not null,
  price_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  cancel_at timestamptz,
  ended_at timestamptz,
  pending_plan text,
  pending_price_id text,
  metadata jsonb not null default '{}'::jsonb,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, stripe_subscription_id),
  unique (provider, subscription_id)
);

alter table public.subscriptions
  add column if not exists provider text;

alter table public.subscriptions
  alter column provider set data type text,
  alter column provider set default 'stripe',
  alter column provider set not null;

alter table public.subscriptions
  add column if not exists subscription_id text;

alter table public.subscriptions
  add column if not exists price_id text;

alter table public.subscriptions
  add column if not exists current_period_start timestamptz;

alter table public.subscriptions
  add column if not exists current_period_end timestamptz;

alter table public.subscriptions
  add column if not exists cancel_at_period_end boolean;

alter table public.subscriptions
  add column if not exists cancel_at timestamptz;

alter table public.subscriptions
  add column if not exists ended_at timestamptz;

alter table public.subscriptions
  add column if not exists pending_plan text;

alter table public.subscriptions
  add column if not exists pending_price_id text;

alter table public.subscriptions
  add column if not exists metadata jsonb;

alter table public.subscriptions
  add column if not exists is_current boolean;

alter table public.subscriptions
  alter column cancel_at_period_end set data type boolean,
  alter column cancel_at_period_end set default false;

alter table public.subscriptions
  alter column metadata set data type jsonb,
  alter column metadata set default '{}'::jsonb,
  alter column metadata set not null;

alter table public.subscriptions
  alter column is_current set data type boolean,
  alter column is_current set default true,
  alter column is_current set not null;

update public.subscriptions
set provider = coalesce(nullif(provider, ''), 'stripe')
where provider is null or provider = '';

update public.subscriptions
set subscription_id = coalesce(subscription_id, stripe_subscription_id)
where subscription_id is null and stripe_subscription_id is not null;

update public.subscriptions
set metadata = '{}'::jsonb
where metadata is null;

update public.subscriptions
set cancel_at_period_end = false
where cancel_at_period_end is null;

update public.subscriptions
set is_current = true
where is_current is null;

update public.subscriptions
set pending_plan = null
where pending_plan is not null and pending_plan not in ('free', 'plus', 'pro');

create unique index if not exists idx_subscriptions_provider_subscription
  on public.subscriptions(provider, subscription_id)
  where subscription_id is not null;

create index if not exists idx_subscriptions_user_current
  on public.subscriptions(user_id)
  where is_current;

create index if not exists idx_subscriptions_subscription_id
  on public.subscriptions(subscription_id)
  where subscription_id is not null;

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

create or replace function public.subscriptions_sync_profile()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.apply_subscription_change(old.user_id);
    return old;
  end if;

  perform public.apply_subscription_change(new.user_id);
  return new;
end;
$$;

drop trigger if exists subscriptions_sync_profile on public.subscriptions;
create trigger subscriptions_sync_profile
after insert or update or delete on public.subscriptions
for each row execute function public.subscriptions_sync_profile();

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
alter table public.collection_collaborators enable row level security;
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
for select using (
  is_public
  or auth.uid() = owner_id
  or exists (
    select 1
    from public.collection_collaborators cc
    where cc.collection_id = id and cc.user_id = auth.uid()
  )
);

drop policy if exists collection_items_owner_crud on public.collection_items;
create policy collection_items_owner_crud on public.collection_items
for all using (
  exists (
    select 1 from public.collections c
    where c.id = collection_id and (
      c.owner_id = auth.uid()
      or exists (
        select 1 from public.collection_collaborators cc
        where cc.collection_id = c.id and cc.user_id = auth.uid()
      )
    )
  )
)
with check (
  exists (
    select 1 from public.collections c
    where c.id = collection_id and (
      c.owner_id = auth.uid()
      or exists (
        select 1 from public.collection_collaborators cc
        where cc.collection_id = c.id and cc.user_id = auth.uid()
      )
    )
  )
);

drop policy if exists movies_read on public.movies;
create policy movies_read on public.movies
for select using (true);

drop policy if exists collection_collaborators_select on public.collection_collaborators;
create policy collection_collaborators_select on public.collection_collaborators
for select using (
  auth.uid() = user_id
  or auth.uid() = owner_id
);

drop policy if exists collection_collaborators_owner_manage on public.collection_collaborators;
create policy collection_collaborators_owner_manage on public.collection_collaborators
for all using (
  auth.uid() = owner_id
)
with check (
  auth.uid() = owner_id
);

drop policy if exists collection_collaborators_self_delete on public.collection_collaborators;
create policy collection_collaborators_self_delete on public.collection_collaborators
for delete using (auth.uid() = user_id);

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
    where c.id = collection_id and (
      c.is_public
      or c.owner_id = auth.uid()
      or exists (
        select 1 from public.collection_collaborators cc
        where cc.collection_id = c.id and cc.user_id = auth.uid()
      )
    )
  )
);

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
for insert with check (
  auth.uid() = user_id
  and (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and c.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.collection_collaborators cc
      where cc.collection_id = collection_id and cc.user_id = auth.uid()
    )
  )
);

drop policy if exists comments_owner_delete on public.comments;
create policy comments_owner_delete on public.comments
for delete using (
  auth.uid() = user_id
  or exists (
    select 1 from public.collections c
    where c.id = collection_id and c.owner_id = auth.uid()
  )
  or exists (
    select 1 from public.collection_collaborators cc
    where cc.collection_id = collection_id and cc.user_id = auth.uid()
  )
);

drop policy if exists follows_owner_crud on public.follows;
create policy follows_owner_crud on public.follows
for all using (auth.uid() = follower_id)
with check (auth.uid() = follower_id);

drop policy if exists subscriptions_owner_rw on public.subscriptions;
drop policy if exists subscriptions_read_own on public.subscriptions;
create policy subscriptions_read_own on public.subscriptions
for select using (auth.uid() = user_id);

drop policy if exists subscriptions_service_manage on public.subscriptions;
create policy subscriptions_service_manage on public.subscriptions
for all using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

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
