# AI Agent Briefing — src/app/api/stripe

## Overview
Stripe webhook handlers live here. They verify incoming events, enforce idempotency, and sync subscription state back to Supabase.

## Routes
- `POST /api/stripe/webhook`: verifies the Stripe signature, short-circuits duplicate events via `public.stripe_webhook_events`, and handles:
  - `checkout.session.completed`
  - `customer.subscription.created|updated|deleted`
  - `customer.created`

## Processing Flow
1. Verify the signature with `STRIPE_WEBHOOK_SECRET`.
2. Ignore events outside the supported list.
3. If the event id already exists in `public.stripe_webhook_events`, return early.
4. Upsert the `public.subscriptions` row, then update `public.profiles.plan` and `stripe_customer_id`.
5. Record the processed event id for idempotency and revalidate relevant Next.js routes (`/app`, `/settings/billing`, `/settings/profile`).

## Update Protocol
- When new event types are introduced, document them here and mirror the changes in `@/lib/billing`.
- Schema changes to `subscriptions` or webhook storage must be reflected in the Supabase schema briefing under `db/`.
