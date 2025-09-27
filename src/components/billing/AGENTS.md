# AI Agent Briefing — src/components/billing

## Overview
Client-side billing UI lives here, orchestrating upgrade flows with the Stripe-powered API routes and surfacing plan details inside the app.

## Key Components
- `billing-settings.tsx`: renders the billing dashboard with upgrade buttons, Stripe checkout/portal actions, export links, and contextual messaging based on the member's current plan. Uses `/api/billing/checkout`, `/api/billing/portal`, and the data export routes.

## Update Protocol
- Document new billing widgets (upgrade modals, in-product upsells) as they are added so agents know how to trigger checkout or portal sessions.
- If the checkout/portal endpoints change, update the references here and in `@/lib/billing` to keep consumers aligned.
