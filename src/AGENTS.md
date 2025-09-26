# AI Agent Briefing — src

## Overview
The `src` tree contains all application code for FrameVault: Next.js routes, React components, domain logic, Supabase clients, and shared types. The structure mirrors feature boundaries for the collections product.

## Key Subdirectories
- `app/` — Next.js App Router structure, including authenticated dashboards, server actions, API routes, and public-facing pages.
- `components/` — Reusable UI and feature components (auth forms, collection editors, providers, plan messaging, etc.).
- `lib/` — Domain logic and service helpers (Supabase accessors, TMDB integration, slugs, rate limiting, utilities).
- `types/` — Shared TypeScript interfaces used across components and routes.

## Global Assets
- `app/globals.css` holds Tailwind-style utility classes and theme overrides.
- Root layout/page files define the landing experience and provider wiring.

## Update Protocol
- Whenever new subdirectories or modules are added, create/update the respective `AGENTS.md` and revise this overview to enumerate them.
- If global conventions change (e.g., provider composition, styling approach), record the adjustments here so downstream directories inherit the context accurately.
