# AI Agent Briefing — src/app/(app)/settings/billing

## Overview
Server component route for the authenticated billing settings page. Fetches the member profile and subscription snapshot before rendering `BillingSettings` on the client.

## Behaviour
- Redirects unauthenticated visitors to `/auth/sign-in`.
- Loads `profiles` and `subscriptions` in parallel to hydrate plan status, renewal date, and checkout toast flags (`checkoutSuccess`, `checkoutCanceled`).
- Passes the snapshot to `@/components/billing/billing-settings`, which orchestrates Stripe Checkout and portal interactions.

## Update Protocol
- Mirror any query string changes used for toast messaging (e.g., additional status flags) in the component briefing.
- When subscription fields or plan metadata evolve, update the select list here and sync the shape with `BillingSettings` props.
