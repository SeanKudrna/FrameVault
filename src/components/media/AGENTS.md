# AI Agent Briefing — src/components/media

## Overview
Media-focused UI helpers live here. They handle poster rendering, fallbacks, and responsive imagery across the app.

## Key Component
- `poster-image.tsx` (`PosterImage`):
  - Client component wrapping `next/image` to load TMDB posters with graceful fallbacks.
  - Tracks failure state, cycles through TMDB sizes, and optionally refetches via `/api/tmdb/movie?refresh=1` when assets fail.
  - Uses `/images/poster-placeholder.svg` as an ultimate fallback.

## Update Protocol
- Document additional media utilities here as they are created.
- When response handling or API usage changes (e.g., different endpoints or size lists), ensure this briefing reflects the new logic and dependent AGENTS entries are updated.
