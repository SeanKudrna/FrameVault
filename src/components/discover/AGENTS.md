# AI Agent Briefing — src/components/discover

## Overview
Houses client-side components for the discovery experience: trending collection grids and curator profile headers with follow interactions.

## Key Components
- `discover-grid.tsx`: renders cards for public collections, showing cover art, owner info, follower counts, and follow/unfollow buttons wired to `followUserAction`/`unfollowUserAction`.
- `profile-header.tsx`: powers `/c/[username]` headers, displaying avatar, follower totals, and a primary follow toggle.

## Integration Notes
- Both components expect to receive precomputed follower counts and initial follow state from server loaders.
- Actions revalidate `/discover` and profile routes, so avoid local caching that would mask updates.
