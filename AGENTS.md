# AI Agent Briefing — FrameVault Root

## Overview
FrameVault is a Next.js App Router project that delivers a Supabase-backed movie collection experience with TMDB-powered metadata. The repo includes server actions for CRUD, authenticated dashboards, public collection pages, and supporting UI systems such as custom toasts and providers. Supabase acts as both the authentication layer and primary database; TMDB requests are proxied and rate limited through our own API routes.

## Key Domains
- `src/app` contains the Next.js routes, including authenticated dashboard flows, auth screens, API proxies, and public sharing pages.
- `src/components` houses reusable UI, providers, feature modules (collections, profile, plan gates), and shared building blocks used across routes.
- `src/lib` exposes domain logic: auth helpers, plan gating, TMDB fetch/cache pipelines, Supabase client factories, API helpers, and utilities.
- `db` defines the Supabase SQL schema, triggers, and helper functions that power collections, movies, and rate limiting.
- `public` stores static assets such as SVGs and the fallback poster placeholder.
- `scripts` currently holds the Supabase seeding script for creating demo data.
- `plans` documents the product roadmap and multi-day implementation notes.

## Runtime & Tooling
- Framework: Next.js (App Router, Server Actions) with TypeScript and React.
- Runtime: Node.js 20+ (development and deployment).
- UI: Tailwind-esque utility classes (via classnames) with Lucide icons and Radix UI primitives.
- Data: Supabase (auth + Postgres) plus TMDB API integrations with service-role caching and custom rate limiting.
- State: Supabase client context, React Query, custom toast provider.
- Commands: `npm run dev`, `npm run lint`, and `npm run build`. `scripts/seed.ts` seeds demo content using Supabase service creds.

## Cross-Cutting Concerns
- Supabase credentials are read from environment via `@/env`; ensure `.env.local` stays in sync with AGENTS guidance.
- TMDB calls run through `/api/tmdb/*` routes, enforcing rate limits and caching movies back into Supabase.
- UI components rely on consistent design tokens (rounded corners, slate/indigo palette) and expect Tailwind-style utility classes.
- Profile usernames double as public route segments (`/c/:username/:slug`); keep slug helpers and server actions coordinated.

## Update Protocol
- Whenever functionality, data contracts, or folder structure changes, update each affected `AGENTS.md` (root and nested) to reflect new responsibilities or dependencies.
- Keep environment prerequisites and workflow notes current if commands, scripts, or external services change.
- When adding new directories, create a matching `AGENTS.md` describing its role and reference it from parent folders.
