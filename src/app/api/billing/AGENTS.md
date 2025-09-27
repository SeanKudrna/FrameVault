# AI Agent Briefing — src/app/api/billing

## Overview
Stripe billing endpoints that authenticate via Supabase and talk to the Stripe REST API.

## Routes
- `POST /api/billing/checkout`: expects `{ plan: 'plus' | 'pro' }`. Creates a Stripe Checkout session (subscription mode), ensures a customer exists, and returns `{ url }` for redirecting.
- `GET /api/billing/portal`: requires the member to have a `stripe_customer_id`; returns `{ url }` for the Stripe customer portal.

## Operational Notes
- Both routes require an authenticated Supabase session. Errors are returned as `{ error, message }` with appropriate HTTP status codes.
- Checkout metadata embeds `supabase_user_id` and `plan` so the webhook handler can reconcile subscriptions.
- Environment variables `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_SITE_URL` must be configured for these routes to function.
