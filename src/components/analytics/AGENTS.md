# AI Agent Briefing — src/components/analytics

## Overview
Client components that render the Pro analytics dashboard live here. The layout visualises aggregated metrics returned from `@/lib/analytics` and exposes summary cards, progress bars, and activity timelines.

## Key Component
- `analytics-dashboard.tsx`: renders the `/analytics` route for Pro members, presenting top genres/directors/actors, yearly cadence, average ratings, collection highlights, and recent activity.
  - Expects an `AnalyticsOverview` payload plus the viewer `Profile` to personalise copy.
  - Uses simple motion-powered bars for charts; no external charting library is required.

## Integration Notes
- Streaming data comes from server components—keep metric shape changes in sync with `@/lib/analytics` and the `/analytics` route.
- When extending the dashboard, prefer adding new sections inside this component so the route remains a thin data loader.
