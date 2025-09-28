begin;

alter table public.profiles add column if not exists plan_expires_at timestamptz;
alter table public.profiles add column if not exists next_plan text;
alter table public.profiles add column if not exists plan_source text not null default 'manual';

update public.profiles
set plan_source = coalesce(plan_source, 'manual')
where plan_source is null;

update public.profiles
set next_plan = null
where next_plan is not null and next_plan not in ('free', 'plus', 'pro');

alter table public.subscriptions add column if not exists provider text;
alter table public.subscriptions alter column provider set default 'stripe';
update public.subscriptions
set provider = coalesce(nullif(provider, ''), 'stripe')
where provider is null or provider = '';
alter table public.subscriptions alter column provider set not null;

alter table public.subscriptions add column if not exists subscription_id text;
alter table public.subscriptions add column if not exists price_id text;
alter table public.subscriptions add column if not exists current_period_start timestamptz;
alter table public.subscriptions add column if not exists cancel_at_period_end boolean;
alter table public.subscriptions alter column cancel_at_period_end set default false;
update public.subscriptions set cancel_at_period_end = false where cancel_at_period_end is null;

alter table public.subscriptions add column if not exists cancel_at timestamptz;
alter table public.subscriptions add column if not exists ended_at timestamptz;
alter table public.subscriptions add column if not exists pending_plan text;
update public.subscriptions
set pending_plan = null
where pending_plan is not null and pending_plan not in ('free', 'plus', 'pro');

alter table public.subscriptions add column if not exists pending_price_id text;
alter table public.subscriptions add column if not exists metadata jsonb;
alter table public.subscriptions alter column metadata set default '{}'::jsonb;
update public.subscriptions set metadata = '{}'::jsonb where metadata is null;
alter table public.subscriptions alter column metadata set not null;

alter table public.subscriptions add column if not exists is_current boolean;
alter table public.subscriptions alter column is_current set default true;
update public.subscriptions set is_current = true where is_current is null;
alter table public.subscriptions alter column is_current set not null;

update public.subscriptions
set subscription_id = coalesce(subscription_id, stripe_subscription_id)
where subscription_id is null and stripe_subscription_id is not null;

create unique index if not exists idx_subscriptions_provider_subscription
  on public.subscriptions(provider, subscription_id)
  where subscription_id is not null;

create index if not exists idx_subscriptions_user_current
  on public.subscriptions(user_id)
  where is_current;

create index if not exists idx_subscriptions_subscription_id
  on public.subscriptions(subscription_id)
  where subscription_id is not null;

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

alter table public.subscriptions enable row level security;

drop policy if exists subscriptions_owner_rw on public.subscriptions;
drop policy if exists subscriptions_read_own on public.subscriptions;
drop policy if exists subscriptions_service_manage on public.subscriptions;
create policy subscriptions_read_own on public.subscriptions
for select using (auth.uid() = user_id);
create policy subscriptions_service_manage on public.subscriptions
for all using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

commit;
