# AI Agent Briefing — src/app/api/stripe/webhook

## Overview
Implements the `POST /api/stripe/webhook` endpoint that verifies Stripe signatures, guards against duplicate deliveries, and syncs subscription state back into Supabase.

## Event Handling
- `checkout.session.completed`: retrieves the subscription, upserts `public.subscriptions`, and stamps `profiles.stripe_customer_id`.
- `customer.subscription.created|updated|deleted`: updates `public.subscriptions`, derives the effective plan via `@/lib/billing`, and keeps `profiles.plan` in sync.
- `customer.created`: backfills `stripe_customer_id` on the profile when Stripe provisions a customer out of band.

## Idempotency
- Persists `event_id`/`event_type` to `public.stripe_webhook_events`; duplicates short-circuit before processing.
- Errors writing the idempotency record respond with a 500 so retries can be replayed safely.

## Dependencies
- `@/lib/stripe` for the configured Stripe SDK instance.
- `@/lib/billing` for plan resolution helpers.
- `@/lib/supabase/service` for service-role database access.

## Update Protocol
- Add new event types both here and in the parent `stripe` briefing when the webhook grows.
- Document any changes to revalidation targets or downstream side-effects (e.g., new paths to refresh).
