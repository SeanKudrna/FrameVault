# AI Agent Briefing — src/app/api/export.csv

## Overview
Streams a CSV export of the authenticated member's collections/items. Relies on `prepareExportPayload` for gating and uses a Web Stream to emit rows incrementally.

## Key Behaviour
- Requires Plus/Pro plan; returns `403` for Free.
- Rate-limited (~1 request/minute) via `enforceRateLimit('export', …)`.
- Emits grouped sections per collection: intro rows (`Collection`, `Description`) followed by a two-column table of movie titles and notes (with a placeholder when empty).
- Sets `Content-Disposition: attachment; filename="framevault-export.csv"`.
