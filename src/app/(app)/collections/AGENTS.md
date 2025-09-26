# AI Agent Briefing — src/app/(app)/collections

## Overview
Server actions for collection CRUD operations live here along with nested editor routes. The directory acts as the logic hub for authenticated collection management.

## Key File
- `actions.ts` implements server actions:
  - `createCollectionAction` validates plan limits, generates unique slugs, and inserts new collections.
  - `updateCollectionDetailsAction` updates titles/descriptions/public state, maintains slug uniqueness, and revalidates dashboard + public paths.
  - `deleteCollectionAction` removes a collection and revalidates dependent routes.
  - Helpers load the active profile and handle revalidation when visibility changes.

## Dependencies
- Uses Supabase server and service clients, `@/lib/api` for errors, plan gating helpers, slug utilities, and Next.js revalidation APIs.
- Triggers UI refreshes for `/app`, `/collections/:id`, and public `/c/:username/:slug` pages.

## Update Protocol
- Document new server actions or helper utilities here along with their side effects and revalidation targets.
- If data requirements change (e.g., new fields on collections), note them and sync with client components' `AGENTS.md` entries.
