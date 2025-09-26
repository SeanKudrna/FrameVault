# AI Agent Briefing — public

## Overview
Static assets served by Next.js live here. The directory primarily houses SVG icons and imagery referenced by UI components, along with favicon assets.

## Key Assets
- Root SVGs (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`) support marketing and UI illustration needs.
- `images/` contains reusable imagery, including poster placeholders consumed by `PosterImage`.
- `favicon.ico` is the default site icon; update in tandem with any branding refresh.

## Usage Notes
- Assets are served directly from `/public`; reference them with absolute paths (e.g., `/images/poster-placeholder.svg`).
- Maintain lightweight vector content where possible to keep bundle sizes small.

## Update Protocol
- When adding, replacing, or removing assets, update this `AGENTS.md` (and nested ones) to describe new resources and consumers.
- Ensure any asset that changes semantics (e.g., placeholder design) is noted so dependent components can be reviewed.
