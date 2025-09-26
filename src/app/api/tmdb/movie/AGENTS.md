# AI Agent Briefing — src/app/api/tmdb/movie

## Overview
Handles GET requests to `/api/tmdb/movie`. Clients (e.g., `PosterImage`) call this endpoint to fetch or refresh metadata for a specific TMDB movie.

## Key File
- `route.ts` delegates to `handleMovie`, catching errors to return a standardized 500 response with logging. Supports optional `refresh=1` to force a TMDB refetch and cache update.

## Update Protocol
- Document any new query parameters or response fields here and in `@/lib/tmdb` where the heavy lifting occurs.
- If error messaging changes, note it so client components can adapt gracefully.
