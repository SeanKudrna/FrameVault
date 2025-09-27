# AI Agent Briefing — src/app/api/billing/portal

## Overview
`GET /api/billing/portal` returns a Stripe Customer Portal session URL so members can manage subscriptions, invoices, and payment methods.

## Key Behaviours
- Requires an authenticated Supabase session and an existing `stripe_customer_id`.
- Responds with `{ url }` on success; surfaces friendly `{ error, message }` payloads otherwise.
- Uses `NEXT_PUBLIC_SITE_URL` for the portal return URL so redirects respect the current deployment origin.

## Dependencies
- Supabase server client for session validation and profile lookup.
- `@/lib/stripe` for the configured Stripe SDK client.

## Update Protocol
- Document any changes to return URL behavior or additional metadata requirements.
- If error handling or auth prerequisites change, reflect that in the billing settings documentation.
