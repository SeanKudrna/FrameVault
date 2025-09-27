# AI Agent Briefing — src/components/auth

## Overview
Authentication-specific components live here. They manage Supabase auth flows, form UI, and client-side transitions between sign-in and sign-up modes.

## Key Component
- `sign-in-form.tsx` (`SignInForm`):
  - Client component using `useSupabase` to perform password-based sign-in or sign-up.
  - Reads `mode` from query string, toggles between modes, and displays inline validation.
  - Polls `supabase.auth.getSession()` until a session exists, syncing the provider state and then issuing both `router.replace("/app")` and `router.refresh()` for a deterministic transition.
  - Surfaces guidance when sign-up requires email confirmation and exposes demo credentials for quick access.

## Dependencies
- Relies on UI primitives (`Button`, `Input`), Supabase provider context, and utility `formatError`.

## Update Protocol
- Document additional auth components or new props here.
- When altering sign-in/sign-up logic (e.g., MFA, OAuth), update this briefing to describe new flows and dependencies.
