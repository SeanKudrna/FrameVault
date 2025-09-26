# AI Agent Briefing — src/app/api/tmdb/search

## Overview
Serves GET requests to `/api/tmdb/search`, used throughout the UI to look up movies by query. Responses are ordered with a relevance/popularity heuristic for better top results.

## Key File
- `route.ts` validates the incoming request, invokes `handleSearch`, and returns JSON search results. Errors are caught and logged, returning a 500 with a generic payload.

## Update Protocol
- Keep this briefing updated with any new query parameters, pagination support, or rate limit behavior changes.
- Sync documentation with components (e.g., search modals) that consume this endpoint so expected payload shapes remain accurate.
