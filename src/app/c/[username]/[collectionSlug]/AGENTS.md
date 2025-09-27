# AI Agent Briefing — src/app/c/[username]/[collectionSlug]

## Overview
Renders public, read-only collection pages such as `/c/:username/:slug`. These pages source data from Supabase and respect slug history for backward compatibility.

## Key File
- `page.tsx`:
  - Loads the profile by username (case-insensitive).
  - Fetches the targeted collection, optionally including `collection_items` for display.
  - Handles historic slug redirects and optional `?id=` query fallback.
  - Generates SEO metadata (OpenGraph/Twitter), renders hero cover imagery, and surfaces share actions via `PublicShareActions`.
  - Displays curator info (username, total films, last updated) and renders movie cards using `PosterImage`.
  - Redirects or returns 404 when the collection is not public or missing.

## Integration Notes
- Uses `getSupabaseServerClient` and `getServerEnv` for data and canonical URL construction.
- Relies on `PosterImage` and shared types for rendering movies.

## Update Protocol
- Record any new query parameters, layout components, or SEO logic changes here.
- When the public view exposes additional data (notes, ratings, theming, share UI), update this briefing and dependent component documentation accordingly.
