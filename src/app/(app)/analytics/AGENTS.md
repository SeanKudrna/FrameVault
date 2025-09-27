# AI Agent Briefing — src/app/(app)/analytics

## Overview
Authenticated route for the Pro analytics dashboard. Loads the viewer profile, enforces plan gating, and passes aggregated metrics to `AnalyticsDashboard`.

## Behaviour
- Redirects non-Pro members to `/settings/billing?plan=pro`.
- Fetches analytics via `getAnalyticsOverview(profile.id)` and renders the client dashboard component.

## Update Notes
- Keep this loader light—any new analytics metrics should originate from `@/lib/analytics` so the route remains a data wrapper.
- If plan gating or redirect targets change, mirror those updates here and in navigation logic.
