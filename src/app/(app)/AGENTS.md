# AI Agent Briefing — src/app/(app)

## Overview
This route group represents the authenticated product shell. Requests hitting `/app`, `/collections/...`, or `/settings/...` pass through here after auth checks.

## Key Files
- `layout.tsx` ensures the user is authenticated, loads or creates their `profiles` row, and wraps children in `AppShell` (sidebar navigation + sign-out controls).
- `actions.ts` exposes shared server actions such as the Supabase-backed `signOutAction` used by the client shell.
- `app/page.tsx` loads the signed-in user's collections from Supabase and renders `CollectionsDashboard` with plan gating metadata.
- `app/history/page.tsx` queries `view_logs`, joins cached TMDB metadata, and renders the viewing timeline grouped by month.
- `movies/[tmdbId]/page.tsx` renders the Smart Pick movie detail view, fetching TMDB metadata, watch providers, and the viewer's collections so they can file the title without leaving the page.
- `collections/actions.ts` exposes server actions for creating, updating, and deleting collections with slug management, plan enforcement, and revalidation of relevant routes.
- `settings/actions.ts` provides the profile update server action used by the profile settings form.

## Cross-Dependencies
- Relies on Supabase server/service clients (`@/lib/supabase/*`) and slug utilities (`@/lib/slugs`).
- `AppShell` (from `src/components/layout`) provides the layout; collection components live under `src/components/collections`.

## Update Protocol
- Any change to authentication flow, server actions, or revalidation paths must be reflected here and in affected subfolder briefings.
- When new authenticated subroutes are added, create their own `AGENTS.md` and mention them in the "Key Files" or "Cross-Dependencies" sections as appropriate.
