# AI Agent Briefing — src/app/api/export.json

## Overview
Streams a simplified JSON export focused on collection overviews and movie notes. The route still leverages Web Streams for incremental encoding.

## Key Behaviour
- Shares auth/plan gating with `prepareExportPayload`.
- Serialises to `{ profile: { username, displayName, plan }, collections: [{ title, description, movies: [{ title, note }] }] }`.
- Sets `Content-Disposition: attachment; filename="framevault-export.json"` and `Cache-Control: no-store`.
- Responds with `429` + `Retry-After` when the export rate limit is hit.
