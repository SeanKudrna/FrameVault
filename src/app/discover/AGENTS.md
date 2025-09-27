# AI Agent Briefing — src/app/discover

## Overview
Authenticated discovery route listing trending public collections. Loads the current user, resolves follower counts, and passes curated data to `DiscoverGrid`.

## Behaviour
- Sorts public collections by follower count (fallback to `updated_at`) and limits results for fast rendering.
- Tracks which owners the viewer already follows so buttons hydrate instantly.

## Update Notes
- Any changes to sorting logic or displayed metadata must stay consistent with the grid component to avoid mismatched props.
- When adding new collection badges or filters, compute them here and surface the necessary fields through `DiscoverCollection`.
