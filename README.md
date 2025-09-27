# FrameVault

FrameVault is a Next.js 15 App Router application for building beautifully curated film collections. It couples Supabase authentication and Postgres storage with TMDB metadata proxies, Stripe-managed subscriptions, and rich React UI so cinephiles can organize, share, and grow their libraries.

## Overview
FrameVault delivers a production-ready SaaS foundation with authenticated dashboards, public sharing, and tiered monetization.
- Collections, movies, and activity live in Supabase with row-level security and automated slug history.
- TMDB requests are proxied through `/api/tmdb/*`, cached in Postgres, and shielded by per-user/IP rate limiting.
- UI modules follow a Tailwind-style design system with drag-and-drop editors, custom toasts, and React Query hydration.
- Stripe Checkout, customer portal access, and webhook handlers keep subscription plans in sync across the app.

## Quick Start
1. Install Node.js 20 or newer and npm (the project targets Next.js 15 + React 19).
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env.local` (see Environment section) with Supabase, Stripe, and TMDB credentials. `src/env.ts` enforces validation on boot.
4. Apply the database schema (requires `psql` and `SUPABASE_DB_URL` pointing at your Supabase Postgres instance):
   ```bash
   npm run db:apply
   ```
5. Seed demo content (creates `demo@framevault.dev` with two sample collections and cached movies):
   ```bash
   npm run db:seed
   ```
6. Start the dev server:
   ```bash
   npm run dev
   ```
   Visit `http://localhost:3000` and sign in with the seeded account or create a new user.

Use `npm run build` followed by `npm start` to simulate production and `npm run lint` to run ESLint.

## Environment
Configure `.env.local` with the following keys (validation mirrored in `src/env.ts`):

| Key | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Yes | Base URL for SEO metadata, public links, and redirect callbacks. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL (https://YOUR_PROJECT.supabase.co). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anon key used by the browser client. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key for server actions, exports, and seed scripts. |
| `SUPABASE_DB_URL` | Yes (for migrations/seeds) | Postgres connection string consumed by `npm run db:apply` and seeds. |
| `DATABASE_URL` | Optional | Alias for local tooling that also points to the Supabase Postgres instance. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Required when billing | Publishable key for Stripe Checkout embeds. |
| `STRIPE_SECRET_KEY` | Required when billing | Stripe secret key used by server routes and webhooks. |
| `STRIPE_WEBHOOK_SECRET` | Required when billing | Signing secret for `/api/stripe/webhook`. |
| `TMDB_V4_READ_TOKEN` | Yes | Bearer token for TMDB API requests. |
| `TMDB_API_KEY` | Optional | v3 API key when legacy endpoints are needed. |
| `TMDB_API_BASE` | Optional (default `https://api.themoviedb.org/3`) | Override TMDB REST base URL if required. |
| `TMDB_IMAGE_BASE` | Optional (default `https://image.tmdb.org/t/p`) | Override TMDB image CDN base. |

Rotate credentials for production deployments and avoid committing real secrets.

## Features

### Curate & Share Collections
- Supabase-backed auth and profile onboarding guarantee every member has a username used for routing and public sharing.
- The collection editor supports drag-and-drop ordering, note editing, rating stubs, and watch status toggles, with changes persisted via server actions.
- `/app/history` renders a monthly timeline sourced from `view_logs`, giving members context on watched, watching, and watchlist activity.
- Public collection pages (`/c/:username/:slug`) honour slug history, render TMDB-enriched metadata, expose share actions, and ship with dynamic Open Graph + sitemap/robots generation.

### Plus Tier Capabilities
- Plan gating in `src/lib/plan.ts` unlocks unlimited collections once members upgrade beyond the free five-shelf limit.
- Cover uploads flow through `uploadCollectionCoverAction`, storing media in the public `covers` bucket with responsive previews in the editor.
- Accent themes defined in `src/lib/themes.ts` provide curated colour palettes for public pages and dashboards.
- CSV and JSON exports stream from `/api/export.{csv,json}` with Plus/Pro enforcement and shared rate limiting to protect infrastructure.

### Billing & Plan Management
- `/api/billing/checkout` boots Stripe Checkout sessions tied to `STRIPE_PRICE_IDS`, redirecting members based on the selected plan.
- `/api/billing/portal` opens the Stripe customer portal so members can manage upgrades, downgrades, and payment methods.
- `/api/stripe/webhook` validates signatures, maps price IDs back to app plans, and updates `profiles.plan` before revalidating caches.
- Billing helpers in `src/lib/billing.ts` and UI gates in `src/components/billing` keep plan messaging consistent across the product.

### TMDB Resilience & Rate Limiting
- `src/lib/tmdb.ts` caches search and detail responses in `public.movies` with seven-day freshness windows to minimise external calls.
- `src/lib/rate-limit.ts` enforces per-user and per-IP windows using the `tmdb_rate_limit` table, surfacing retry hints for throttled clients.
- The `PosterImage` component gracefully falls back between TMDB sizes, cached backups, and local placeholders to avoid blank posters.
- Shared error helpers in `src/lib/api.ts` standardise JSON payloads and `Retry-After` headers for all TMDB and export endpoints.

## Architecture
- `src/app`: Next.js App Router routes for marketing, auth, dashboard (`(app)`), settings, API proxies, and public collection pages.
- `src/components`: Feature modules for collections, billing, profile, plan gating, media, layout primitives, and global providers.
- `src/lib`: Domain logic spanning Supabase client factories, TMDB proxy functions, billing helpers, rate limiting, exports, plan gating, and utility helpers.
- `src/types`: Shared TypeScript models (`collection`, Supabase enums) consumed by editors, exports, and server actions.
- `db` + `scripts`: Postgres schema (`db/supabase.sql`) defining tables, triggers, policies, buckets plus `scripts/seed.ts` for demo content.
- `public` + `plans`: Static assets (SVGs, placeholders, favicons) and product planning docs/AGENTS clarifying roadmap responsibilities.

## Data Flow & Integrations
- Supabase: Authenticates users, enforces RLS across `profiles`, `collections`, `collection_items`, and `view_logs`, and maintains slug history plus `covers` storage via SQL triggers.
- TMDB: `/api/tmdb/search|movie` call `src/lib/tmdb.ts`, hydrate `public.movies`, and rely on `tmdb_rate_limit` to guard upstream quotas while keeping keys server-side.
- Stripe: Plan to price mappings live in `src/lib/billing.ts`; the webhook updates `profiles.plan`, records subscription status, and triggers Next.js revalidation after billing events.
- Application providers: `src/components/providers/app-providers.tsx` layers Supabase client context, React Query hydration, and the toast system required by interactive dashboards.

## Development Workflow
- Use Node.js 20+, install dependencies with `npm install`, and rely on Next.js 15 + React 19 (Turbopack) for daily development.
- Run `npm run dev` to start the local app at `http://localhost:3000`; pair with `npm run build` then `npm start` to validate production output.
- Execute `npm run lint` to apply the Next.js ESLint config and keep Tailwind-style utilities consistent (`src/app/globals.css` holds shared tokens).
- Manage data with `npm run db:apply` (schema + covers bucket) and `npm run db:seed` (demo account, collections, TMDB cache) whenever you reset environments.

## Deployment Checklist
- Supply production Supabase, TMDB, and Stripe credentials in `.env` and update `STRIPE_PRICE_IDS` if your live price IDs differ from the defaults.
- Apply `db/supabase.sql` to the production database and confirm the public `covers` bucket exists with the expected MIME limits.
- Configure a Stripe webhook pointing to `/api/stripe/webhook`, add the signing secret to env, and verify the customer portal domain matches your deployment.
- Set `NEXT_PUBLIC_SITE_URL` to the deployed origin and review generated `robots.txt` plus `sitemap.xml` before opening indexing.

## Documentation & Resources
- `AGENTS.md` files (root and nested) describe directory responsibilities and should be updated whenever logic or contracts change.
- `plans/init/` captures milestone briefs such as `plan-day-3-pro-growth.md`, outlining upcoming Pro features and growth experiments.
- `db/supabase.sql` is the authoritative schema, including RLS policies, rate-limit tables, triggers, and storage bucket provisioning.
- `.env.local` and `scripts/seed.ts` illustrate expected environment wiring; regenerate secrets for real deployments and avoid sharing demo tokens.

## Roadmap
- Collaborative collections with role-based access control are scoped for the Pro tier (see `plans/init/plan-day-3-pro-growth.md`).
- Smart Picks recommendations derived from viewing history and genre preferences will roll out under the Pro plan.
- Streaming availability badges and analytics dashboards (top genres, directors, yearly breakdowns) remain in active development for Pro.
- Follow graphs, discover pages, and guided onboarding refinements are documented in the Day 3 plan and tracked for future releases.

## License
FrameVault is released under the MIT License. See `LICENSE` for details.
