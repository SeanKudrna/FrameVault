# AI Agent Briefing — src/lib/supabase

## Overview
Supabase client utilities and generated types live here. These abstractions standardize how the app communicates with Supabase across server, browser, and service-role contexts.

## Key Files
- `client.ts`: lazy-instantiates the browser Supabase client using public env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) and suppresses the session-user warning (we revalidate with `auth.getUser()`).
- `server.ts`: builds a cookie-aware server client for App Router routes/actions, suppresses the insecure session-user warning (since we always verify via `auth.getUser()`), and exposes `createSupabaseServerClient` plus cached `getSupabaseServerClient`.
- `service.ts`: service-role client factory for background actions requiring elevated privileges (e.g., caching TMDB results).
- `types.ts`: TypeScript definitions mirroring the Postgres schema (profiles, collections, collection_items, movies, rate-limit tables, etc.).

## Update Protocol
- Regenerate `types.ts` whenever the Supabase schema changes and describe new tables/columns here.
- Document any changes to client creation (cookies, auth options) so agents know how to interact with Supabase safely.
