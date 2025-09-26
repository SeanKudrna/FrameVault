# AI Agent Briefing — src/app/(app)/app

## Overview
This directory defines the authenticated dashboard route served at `/app`. It acts as the entry point after sign-in, showing the user's collections and entry points for creation.

## Key File
- `page.tsx` fetches the current Supabase user and their profile, queries owned collections (including counts via `collection_items`), and renders `CollectionsDashboard` with the aggregated data.

## Integration Notes
- Redirects unauthenticated users to `/auth/sign-in` and users without profiles to `/settings/profile`.
- Depends on `CollectionsDashboard` for UI and on `@/lib/supabase/server` for data access.

## Update Protocol
- If the dashboard adds new data or props, update this briefing and the `CollectionsDashboard` documentation to reflect the expanded contract.
- Note any new redirect conditions or query filters to keep navigational assumptions accurate.
