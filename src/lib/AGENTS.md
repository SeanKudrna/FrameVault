# AI Agent Briefing — src/lib

## Overview
Shared domain logic and service helpers live here. Modules expose reusable utilities for Supabase access, TMDB integration, slug handling, rate limiting, and API response helpers.

## Key Modules
- `api.ts`: standardized JSON responses and `ApiError` class for server actions/routes.
- `auth.ts`: helpers for retrieving verified sessions (via `auth.getUser()`), profiles, and ensuring Supabase profile records exist.
- `plan.ts`: plan limit constants plus `canCreateCollection` and `planGateMessage` helpers.
- `billing.ts`: Stripe price/plan mapping helpers and subscription status evaluation (`getPriceIdForPlan`, `resolveProfilePlan`).
- `stripe.ts`: lazily initialised Stripe SDK client configured from env vars.
- `themes.ts`: shared collection theme catalogue plus helpers for resolving theme IDs stored in the database.
- `export.ts`: loads collections/items for data export (JSON/CSV) with movie metadata enrichment.
- `rate-limit.ts`: Supabase-backed rate limiting enforcement (`enforceRateLimit`) and error typing.
- `request.ts`: utility to extract client IPs from incoming requests.
- `slugs.ts`: slug generation and uniqueness helpers.
- `tmdb.ts`: TMDB proxy core—maps API responses, caches movies in Supabase, enforces rate limits, ranks search results by relevance/popularity, and powers `/api/tmdb/*`.
- `utils.ts`: small UI helpers (`cn`, `truncate`, `formatError`).
- `supabase/`: client factories for browser/service/server contexts plus generated types.
- `version.ts`: single source of truth for the visible FrameVault version string consumed by layouts and documentation.

## Update Protocol
- Document new modules or exported helpers here and update dependent `AGENTS.md` files when contracts change.
- When environment variables or external service assumptions change (e.g., TMDB endpoints, Supabase schema), revise this briefing to signal the new requirements.
