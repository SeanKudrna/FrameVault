# AI Agent Briefing — src/app/(auth)/auth

## Overview
Contains the primary authentication route implementation that powers `/auth/sign-in`.

## Key Files
- `sign-in/page.tsx` loads the Supabase server client, redirects authenticated users to `/app`, and renders the `SignInForm` UI within a branded background.
- `sign-out/page.tsx` ensures clean session termination and redirects to home after sign out.
- `verify-email/page.tsx` presents the post-registration instructions telling new users to confirm their Supabase email before returning to sign in.

## Update Protocol
- Document any additional auth subroutes or new props expected by `SignInForm`.
- If the redirect destinations or layout styling change, capture the updates here so downstream agents understand the flow.
