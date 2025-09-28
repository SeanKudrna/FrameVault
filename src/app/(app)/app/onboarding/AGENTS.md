# AI Agent Briefing — src/app/(app)/app/onboarding

## Overview
Hosts the authenticated onboarding flow shown to members who haven't completed setup. The route guards access to `/app` until `profiles.onboarding_state.completed` is true.

## Behaviour
- Fetches the viewer profile and onboarding state; redirects to `/app` once complete.
- Computes collection/item totals to auto-complete the "add five films" step when thresholds are met.
- Passes lightweight collection metadata (id/title/created_at/count) to the client flow so CTAs can deep-link into the starter collection.
- Updates onboarding milestones via `updateOnboardingStateAction` before rendering `OnboardingFlow`.

## Update Notes
- Ensure onboarding state updates remain idempotent—the page may be refreshed multiple times during setup.
- When adding steps, extend both the `OnboardingState` schema (database + types) and the client flow component.
