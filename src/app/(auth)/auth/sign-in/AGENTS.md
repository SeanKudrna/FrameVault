# AI Agent Briefing — src/app/(auth)/auth/sign-in

## Overview
Defines the actual sign-in page rendered to end users.

## Key File
- `page.tsx` instantiates the Supabase server client, redirects logged-in users to `/app`, and returns the `SignInForm` component within the themed background shell.

## Integration Notes
- Relies on `SignInForm` (`src/components/auth`) for client-side Supabase auth and state handling.
- Background gradients and layout are defined inline; adjust here when updating visual design.

## Update Protocol
- If sign-in flow requirements change (new query params, metadata, alternate layouts), document them here and update related AGENTS for auth components.
