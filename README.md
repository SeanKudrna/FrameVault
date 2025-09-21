# FrameVault Day 1 — MVP Foundation

FrameVault is a Next.js 14 + Supabase app for curating cinematic collections with TMDB-backed search and shareable public views. This repository contains the full Day 1 deliverable: auth, collections CRUD, drag-and-drop ordering, TMDB proxy routes, plan gating, and a seedable Postgres schema.

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Create `.env.local`** (see [Environment](#environment) below).
3. **Apply the database schema** (requires `psql` and a Supabase/Postgres connection string):
   ```bash
   export SUPABASE_DB_URL="postgres://user:pass@host:5432/db"
   npm run db:apply
   ```
4. **Seed demo data** (creates `demo@framevault.dev` with collections + movies):
   ```bash
   npm run db:seed
   ```
5. **Run the app**
   ```bash
   npm run dev
   ```
6. Visit `http://localhost:3000` and sign in with the seeded credentials or create a new account.

## Environment

Create a `.env.local` with the following keys:

```bash
# Next.js
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=...            # Project URL from Supabase dashboard
NEXT_PUBLIC_SUPABASE_ANON_KEY=...       # anon public key
SUPABASE_SERVICE_ROLE_KEY=...           # service role (server-only)
SUPABASE_DB_URL=...                     # Postgres connection string for migrations

# Stripe (Day 2 integration placeholder)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...

# TMDB
TMDB_V4_READ_TOKEN=...
TMDB_API_KEY=61407dedeee085dbde2d1f0d64415768
TMDB_API_BASE=https://api.themoviedb.org/3
TMDB_IMAGE_BASE=https://image.tmdb.org/t/p
```

`SUPABASE_DB_URL` is only required when running `npm run db:apply`; the app itself uses the anon/service keys.

## Database

- `db/supabase.sql` contains the full schema, triggers, and RLS policies described in the Day 1 plan.
- RLS is enabled on every table; `tmdb_rate_limit` is service-role only.
- `scripts/seed.ts` uses the Supabase service key to create a demo user, two collections, and cached TMDB movies (rerunnable).

## TMDB Proxy & Rate Limiting

- `/api/tmdb/search` and `/api/tmdb/movie` are server-only routes that attach the TMDB v4 bearer token.
- Each route enforces **per-user 60/min** and **per-IP 120/min** limits backed by the `public.tmdb_rate_limit` table. Responses return `{ error, message }` and include `Retry-After` when throttled.
- Results are cached in `public.movies` with a 7-day stale window; the proxy never exposes TMDB keys to the client.

## Available Scripts

| Script          | Description |
|-----------------|-------------|
| `npm run dev`   | Next.js dev server (Turbopack) |
| `npm run build` | Production build |
| `npm start`     | Start the production server |
| `npm run lint`  | ESLint using Next.js config |
| `npm run lint:test` | Alias used in CI to run lint |
| `npm run db:apply`  | Apply `db/supabase.sql` using `psql` (requires `SUPABASE_DB_URL`) |
| `npm run db:seed`   | Seed demo user + collections via Supabase service key |

## Day 1 Feature Checklist

- [x] Supabase Auth with profile onboarding and username (case-insensitive unique).
- [x] Collections CRUD with immutable slug history (`previous_slugs`) + redirects.
- [x] TMDB search + movie detail proxy routes, 7-day cache, standardized errors.
- [x] Drag-and-drop ordering via dnd-kit with persisted positions and optimistic UI.
- [x] Public read-only collection page at `/c/[username]/[slug]` with fallback + redirect.
- [x] Free plan gated at 5 collections (UI + server enforcement).
- [x] Seed script (`npm run db:seed`) and demo credentials.

## Happy Path QA

1. Sign in (or sign up) → profile is created automatically.
2. Create up to five collections → sixth attempt returns `{ error: "plan_limit" }` and shows CTA.
3. Open a collection → search TMDB, add movies, drag to reorder, save notes → refresh persists order & notes.
4. Toggle collection public → copy `/c/...` link → loads logged-out; private collections 404 when logged-out.
5. Rename collection → slug changes, previous slug redirects to new slug.
6. Re-run TMDB search rapidly → hitting limits returns `429` with retry message.

## Notes & Next Steps

- Stripe env vars are placeholders for Day 2 billing work.
- The UI uses Tailwind CSS (JIT via tailwindcss v4 + `@tailwindcss/postcss`).
- All Supabase mutations go through server actions with centralized gating and revalidation.

Happy building!
