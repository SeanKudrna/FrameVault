# AI Agent Briefing — src/app/api/billing

## Overview
Stripe billing endpoints that authenticate via Supabase and talk to the Stripe REST API.

## Routes
- `POST /api/billing/checkout`: expects `{ plan: 'plus' | 'pro' }`. Creates a Stripe Checkout session (subscription mode), ensures a customer exists, and returns `{ url }` for redirecting.
- `GET /api/billing/portal`: requires the member to have a `stripe_customer_id`; returns `{ url }` for the Stripe customer portal.
- `POST /api/billing/webhook`: Stripe webhook endpoint that records subscription state (`provider`, `pending_plan`, `cancel_at_period_end`) and relies on Supabase triggers to keep profiles in sync. The handler now performs a manual select/update-or-insert when reconciling `subscriptions` rows so it remains resilient when database constraints drift or legacy duplicates exist, and it preserves the last known paid plan when Stripe sends minimal updates to prevent accidental downgrades. It now fetches pending subscription items via `stripe.subscriptionItems.list(..., { pending: true })` to enrich portal-driven downgrades with price/product metadata and treats zero-dollar pending items as "free" transitions for accurate copy.

## Operational Notes
- Both routes require an authenticated Supabase session. Errors are returned as `{ error, message }` with appropriate HTTP status codes.
- Checkout metadata embeds `supabase_user_id` and `plan` so the webhook handler can reconcile subscriptions.
- Environment variables `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_SITE_URL`, and `BILLING_WEBHOOK_SECRET` must be configured for these routes to function.
- Webhook idempotency is enforced via `stripe_webhook_events`; ensure events are recorded even on error paths.
