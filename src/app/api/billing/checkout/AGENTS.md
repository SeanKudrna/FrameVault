# AI Agent Briefing — src/app/api/billing/checkout

## Overview
`POST /api/billing/checkout` creates Stripe Checkout sessions for Plus and Pro upgrades. The handler verifies Supabase auth, ensures a Stripe customer exists, and returns the redirect URL expected by the client.

## Key Behaviours
- Accepts JSON `{ plan: 'plus' | 'pro' }`; rejects anything else with a 400.
- Lazily provisions `stripe_customer_id` on the profile before creating the session.
- Embeds `supabase_user_id` and `plan` metadata so the webhook can reconcile the subscription.
- Success and cancel URLs redirect to `/settings/billing` with query params for toast messaging.

## Dependencies
- `@/lib/billing` for plan-to-price lookup.
- `@/lib/stripe` for the configured Stripe SDK client.
- Supabase server client via `@/lib/supabase/server` for auth and profile updates.

## Update Protocol
- If new plans are introduced, update the accepted payload here and in `@/lib/billing` plus client consumers.
- Mirror any changes to success/cancel URL handling in the billing settings AGENTS brief.
