# AI Agent Briefing — src/app/(app)/app/history

## Overview
Authenticated timeline view of a member's viewing activity. Groups records from `view_logs` by month and renders movie metadata via the cached TMDB table.

## Key File
- `page.tsx`: fetches the user's `view_logs`, joins cached movie metadata, sorts entries descending by timestamp, and renders grouped sections with status pills.

## Update Protocol
- When additional activity types are tracked (ratings, reviews), update the query and grouping logic here.
- Timeline styling relies on the same status vocabulary (`watched`, `watching`, `want`) used in the collection editor; keep labels/colors consistent across both surfaces.
