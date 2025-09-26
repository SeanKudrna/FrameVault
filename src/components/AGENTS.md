# AI Agent Briefing — src/components

## Overview
Reusable React components live here, organized by domain (auth, collections, layout, media, plan, profile, providers, UI). Components are predominantly client-side and leverage Tailwind-style utility classes.

## Key Subdirectories
- `auth/` — Authentication forms and related UI.
- `collections/` — Dashboard and editor surfaces handling collection CRUD.
- `layout/` — Application shell components such as side navigation.
- `media/` — Media presentation helpers (`PosterImage`).
- `plan/` — Components that communicate plan limitations.
- `profile/` — Profile management forms.
- `providers/` — React context providers (Supabase, React Query, Toasts).
- `ui/` — Shared primitives (buttons, inputs, toasts, etc.).

## Update Protocol
- Add or rename subdirectories only alongside a matching `AGENTS.md` update that captures responsibilities and dependencies.
- When shared design conventions change (e.g., button sizing, toast variants), ensure the relevant subdirectory documentation is updated and reference those updates here if they affect multiple areas.
