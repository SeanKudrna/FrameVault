# AI Agent Briefing — scripts

## Overview
Operational scripts that support FrameVault live here. Use them for seeding data, maintenance, or one-off automation.

## Key Scripts
- `seed.ts` bootstraps a demo Supabase environment. It ensures a known user account exists, upserts their profile, seeds curated TMDB movie metadata, and provisions starter collections/items.
- `sweep-plans.ts` runs the `expire_lapsed_plans` RPC to finalise deferred plan downgrades. Schedule this periodically (Supabase cron/Edge Function) so members who never log back in still transition to their pending tier.

## Usage Notes
- The scripts depend on server-side environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`). Run with `tsx scripts/seed.ts` / `tsx scripts/sweep-plans.ts` after setting `.env.local`.
- Movie payloads are inserted directly; ensure poster paths match TMDB assets and that collection IDs align with schema expectations.

## Update Protocol
- When modifying seed logic or adding new scripts, update this briefing to describe new behaviors and requirements.
- Document any new environment variables or data contracts introduced by scripts so dependent agents remain in sync.
