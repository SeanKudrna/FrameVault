# AI Agent Briefing — src/app/api

## Overview
Serverless API routes live here. They primarily proxy TMDB requests through FrameVault infrastructure to hide API keys, enforce rate limits, and cache results.

## Subdirectories
- `tmdb/` contains endpoints for search and detail lookups. Each route delegates to `@/lib/tmdb` helper functions.

## Operational Notes
- Responses are JSON with standard `{ error, message }` payloads on failure.
- Rate limiting and Supabase caching are handled by the shared TMDB library; API routes should remain thin wrappers.

## Update Protocol
- Document new API namespaces or methods here, noting authentication requirements and helper dependencies.
- Whenever TMDB handler contracts change (params, response shape), update these notes and the `@/lib/tmdb` briefing.
