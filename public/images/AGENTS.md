# AI Agent Briefing — public/images

## Overview
This subdirectory houses reusable image assets, currently focused on poster fallbacks for movie artwork.

## Key Assets
- `poster-placeholder.svg` is the default artwork used by `PosterImage` when TMDB imagery is unavailable or still loading.

## Usage Notes
- The placeholder appears anywhere a collection or public page loads a movie without a resolved poster. Keep the styling consistent with the app's dark aesthetic.
- When updating this SVG, check UI components for dimensions or color assumptions.

## Update Protocol
- Document any new images or significant visual changes here to keep AI agents aware of available assets.
- If the placeholder usage pattern changes, reflect that in this file and in dependent component `AGENTS.md` entries.
