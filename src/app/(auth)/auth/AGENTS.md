# AI Agent Briefing — src/app/(auth)/auth

## Overview
Contains the primary authentication route implementation that powers `/auth/sign-in`.

## Key File
- `sign-in/page.tsx` loads the Supabase server client, redirects authenticated users to `/app`, and renders the `SignInForm` UI within a branded background.

## Update Protocol
- Document any additional auth subroutes or new props expected by `SignInForm`.
- If the redirect destinations or layout styling change, capture the updates here so downstream agents understand the flow.
