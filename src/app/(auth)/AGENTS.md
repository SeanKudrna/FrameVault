# AI Agent Briefing — src/app/(auth)

## Overview
This route group encapsulates public authentication surfaces: the sign-in form and redirect helpers for legacy URLs.

## Key Files
- `auth/sign-in/page.tsx` renders the main sign-in experience after redirecting already authenticated users to `/app`.
- `sign-in/page.tsx` and `signin/page.tsx` provide legacy route aliases that redirect to `/auth/sign-in`.

## Update Protocol
- When introducing new auth flows (e.g., password reset, magic link), add routes here and document them in this briefing.
- Note any changes to redirect logic or provider usage to maintain alignment with `AGENTS.md` in dependent components.
