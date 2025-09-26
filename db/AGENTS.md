# AI Agent Briefing — db

## Overview
This folder contains the Supabase SQL migration (`supabase.sql`) that establishes FrameVault's Postgres schema. It provisions extensions, helper triggers, and all domain tables for profiles, collections, items, cached movies, and TMDB rate limiting.

## Key Elements
- `supabase.sql` creates:
  - `profiles` table mirroring `auth.users`, with triggers to maintain `updated_at`.
  - `collections` with slug history, lowercase enforcement, and publication flags.
  - `collection_items` linking collections to TMDB titles with positional ordering.
  - `movies` cache for TMDB payloads, including fallback poster metadata.
  - `tmdb_rate_limit` (implied via rate limit logic) plus helper trigger functions.
  - Helper functions `set_updated_at`, `collections_slug_history`, and `slug_lowercase`.

## Operational Notes
- The schema expects Supabase auth to be enabled; triggers rely on Postgres functions defined early in the script.
- Rate limit enforcement in `src/lib/rate-limit.ts` assumes the presence of `tmdb_rate_limit` table defined here.
- Maintain idempotency: the script uses `if not exists` safeguards to support repeat execution.

## Update Protocol
- Any schema or trigger changes must be mirrored here and communicated to downstream consumers (server actions, types, Supabase client types).
- After altering schema elements, regenerate TypeScript types (`src/lib/supabase/types.ts`) and adjust AGENTS documentation wherever affected data is consumed.
- Ensure this file stays synchronized with production Supabase migrations; update AGENTS whenever new tables or behaviors are introduced.
