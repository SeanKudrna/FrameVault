# AI Agent Briefing — src/app/(auth)/auth/sign-out

## Overview
Server-side sign-out completion page that ensures clean session termination and redirects users to the home page.

## Key Behaviour
- Runs entirely server-side to guarantee proper auth state cleanup
- Immediately redirects to "/" after server-side processing
- Relies on the SupabaseProvider's sign-out logic to clear client state before navigation

## Integration Notes
- Called by the SupabaseProvider's signOut function after clearing client state
- Ensures the sign-out process is completely server-controlled
- Prevents any client-side auth state issues from affecting the sign-out flow
