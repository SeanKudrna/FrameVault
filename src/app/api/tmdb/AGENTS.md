# AI Agent Briefing — src/app/api/tmdb

## Overview
Encapsulates TMDB proxy endpoints used by the client for search and movie detail fallback fetches. These routes rely on shared logic for authentication, caching, and rate limiting.

## Key Routes
- `search/route.ts` wraps `handleSearch`, validating query length, enforcing rate limits, and returning mapped movie summaries.
- `movie/route.ts` wraps `handleMovie`, returning enriched metadata and ensuring cache freshness when `refresh=1` is supplied.

## Update Protocol
- Record any new TMDB endpoints or query parameters here.
- If error handling or logging expectations change, update this documentation along with downstream components relying on API responses.
