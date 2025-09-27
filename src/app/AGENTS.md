# AI Agent Briefing — src/app

## Overview
`src/app` implements the Next.js App Router surface. It includes the global layout, marketing landing page, authenticated application segments (via nested route groups), API proxies, and public collection pages.

## Key Files
- `layout.tsx` wires fonts, global providers (`AppProviders`), verifies Supabase sessions via `auth.getUser()`, ensures a profile record exists for signed-in users, and renders the global footer showing the current FrameVault version.
- `page.tsx` renders the marketing landing page highlighting product features, pricing snapshot, and CTAs.
- `pricing/page.tsx` provides the standalone pricing matrix with plan comparisons and FAQs.
- `globals.css` defines shared styles and resets.
- `favicon.ico` is the app icon served by Next.js.

## Key Route Groups
- `(app)/` — Authenticated application shell with dashboard, collection editor, and settings subroutes.
- `(auth)/` — Authentication experience, including the sign-in form and redirecting legacy paths.
- `api/` — Serverless API routes covering TMDB proxies, billing endpoints (`/api/billing/*`), and Stripe webhooks.
- `c/` — Public reader experience for shared collections (`/c/:username/:slug`).

## Update Protocol
- When adding or renaming route groups, update this file to keep navigation context current.
- If global layout responsibilities change (providers, metadata, fonts), reflect the new flow here and in dependent `AGENTS.md` entries.
