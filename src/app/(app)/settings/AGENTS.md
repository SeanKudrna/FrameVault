# AI Agent Briefing — src/app/(app)/settings

## Overview
Holds server actions and route groups that power the authenticated settings area (profile configuration and billing).

## Key Files
- `actions.ts` exposes `updateProfileAction`, which slugifies and validates usernames, checks for conflicts, updates the `profiles` table, and revalidates dependent routes (`/settings/profile`, `/app`, and `/c/:username`).
- `billing/page.tsx` renders the Stripe-powered billing dashboard via `BillingSettings`, including upgrade buttons and the customer portal entry.

## Update Protocol
- Document additional settings actions or subroutes here as they are introduced.
- Whenever the profile update workflow gains new fields or validation rules, record those behaviors so UI components stay aligned.
- Note billing workflow changes (new plans, downgrade copy, CTA destinations) so the component and `/api/billing/*` routes stay coherent.
