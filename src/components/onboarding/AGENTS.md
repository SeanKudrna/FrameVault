# AI Agent Briefing — src/components/onboarding

## Overview
Client components orchestrating the three-step onboarding flow: profile claim, starter collection creation, and initial movie curation.

## Key Component
- `onboarding-flow.tsx`: renders the onboarding steps, calls `updateProfileAction`, `createStarterCollectionAction`, and `updateOnboardingStateAction`, and surfaces progress messaging.
  - Hides completed steps so the checklist shrinks as milestones are hit.
  - Surfaces "Add now" (opens the primary collection) and "Skip for now" actions for the movie step; skip finalizes onboarding via `updateOnboardingStateAction({ completed: true })`.
  - Expects `initialCollections` to include id/title/createdAt/itemCount so it can route the CTA to the freshest, emptiest collection.

## Integration Notes
- The component consumes totals (collections/items) plus lightweight collection metadata from the server page to show progress, infer completion, and decide where to send the "Add now" CTA.
- Whenever onboarding logic changes, keep this component and `@/app/(app)/onboarding/page.tsx` in sync to avoid stale state.
