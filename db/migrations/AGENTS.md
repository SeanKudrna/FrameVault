# AI Agent Briefing — db/migrations

## Overview
This directory contains incremental Supabase SQL migrations that accompany the canonical schema in `db/supabase.sql`. Each migration targets production environments by applying additive schema changes, new helper functions, and trigger updates without requiring a full schema reset.

## Current Migrations
- `20240909_plan_rollover.sql` introduces deferred plan downgrade support. It adds schedule columns to `profiles`, expands `subscriptions` metadata, defines plan resolution functions/triggers, and refreshes RLS policies so billing webhooks remain authoritative.

## Usage
- Apply migrations in chronological order when deploying to Supabase. The scripts are idempotent and rely on `if not exists` guards where reuse is unavoidable.
- After running a migration, regenerate TypeScript types (`src/lib/supabase/types.ts`) to keep compile-time contracts in sync.

## Maintenance Notes
- Keep migration filenames sortable by date to simplify deployment sequences.
- When updating the schema via migrations, always mirror the final state in `db/supabase.sql` so fresh environments stay accurate.
