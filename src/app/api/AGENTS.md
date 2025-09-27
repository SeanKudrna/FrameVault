# AI Agent Briefing — src/app/api

## Overview
Serverless API routes live here. They primarily proxy TMDB requests through FrameVault infrastructure to hide API keys, enforce rate limits, and cache results.

## Subdirectories
- `tmdb/` contains endpoints for search and detail lookups. Each route delegates to `@/lib/tmdb` helper functions.
- `billing/` exposes authenticated routes for starting Stripe Checkout sessions and opening the customer portal.
- `stripe/` houses the webhook handler that syncs subscription state back into Supabase.
- `export.csv` & `export.json` stream data exports (Plus/Pro only) with rate limiting.

## Operational Notes
- Responses are JSON with standard `{ error, message }` payloads on failure.
- Billing routes require a Supabase session and rely on `@/lib/billing` + `@/lib/stripe` for plan/price mapping.
- The Stripe webhook verifies signatures, records processed events, and revalidates key routes after syncing plans.
- TMDB endpoints keep rate limiting and caching inside `@/lib/tmdb` so the route files stay thin.
- Export routes enforce Plus/Pro gating, reuse `enforceRateLimit` (`bucket: export`), and stream CSV/JSON responses via the Web Streams API.

## Update Protocol
- Document new API namespaces or methods here, noting authentication requirements and helper dependencies.
- Whenever TMDB handler contracts change (params, response shape), update these notes and the `@/lib/tmdb` briefing.
