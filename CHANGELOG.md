# Changelog

All notable changes to FrameVault will be documented in this file.

## [Unreleased]

### Fixed
- Stripe schedule-based downgrades now populate `pending_plan`/`next_plan`, ensuring deferred plan changes appear on the billing screen and apply automatically at renewal.

## [0.0.3] - 2025-09-30

### Added
- Deferred subscription downgrades powered by new Supabase functions (`apply_subscription_change`, `compute_effective_plan`, `expire_lapsed_plans`) and a nightly plan sweeper script.
- Unified billing webhook at `/api/billing/webhook` with richer subscription metadata, pending plan tracking, and automatic profile sync.
- Scheduled maintenance helper `scripts/sweep-plans.ts` for expiring queued downgrades outside of interactive sessions.

### Changed
- Auth/session helpers now resolve the effective plan on every profile fetch to ensure grace periods honour cancel-at-period-end downgrades.
- Billing settings surface scheduled plan changes (“Downgrades to Free on …”) alongside the active subscription status.
- Stripe checkout/portal routes call the new plan RPCs before fetching profile data to avoid stale plan state during upgrades.

## [0.0.2] - 2025-09-27

### Added
- Smart Picks recommendations rail on the dashboard with personalised TMDB Discover results and explanatory rationale for Pro members.
- Streaming availability badges inside the collection editor, powered by the new `/api/tmdb/providers` endpoint and per-profile region preferences.
- Pro analytics dashboard summarising top genres/directors/actors, yearly cadence, recent activity, and average ratings.
- Collaborative collections: invite/remove editors via the new `collection_collaborators` table with expanded RLS and UI management.
- Discover page (`/discover`) highlighting trending public collections with follow/unfollow controls, plus curator profile pages at `/c/:username`.
- Guided onboarding flow that walks new members through claiming their profile, spinning up a starter shelf, and adding their first five films.
- Dynamic collection OG images (`/api/og/collection`) for richer social sharing previews.

### Changed
- Dashboard now redirects incomplete accounts to the onboarding flow and surfaces Smart Picks only for Pro plans.
- Settings profile form supports updating the preferred streaming region alongside username/display name.
- Supabase schema gains onboarding state, preferred region, watch-provider cache, collaborator table, and discovery-friendly indexes.

## [0.0.1] - 2025-09-26

### Added
- Supabase authentication flow with profile onboarding, username enforcement, and row-level security across collections and view logs.
- Collection management dashboard with create, rename, delete, drag-and-drop ordering, TMDB-powered search, and public visibility controls.
- TMDB proxy layer with rate limiting, cached movie metadata, and resilient poster fallbacks surfaced throughout the editor and public pages.
- Public marketing site, pricing matrix, and SEO-friendly collection sharing routes with slug history redirects and sitemap/robots support.
- Stripe Checkout, customer portal, and webhook handling wired to upgrade profiles between Free, Plus, and Pro plans with plan-aware gating helpers.
- Watch status toggles (Watched, Watching, Want) with a personal history timeline backed by the `view_logs` table.
- Plus tier enhancements including cover uploads, accent themes, unlimited collections, and CSV/JSON export endpoints with rate limiting.

### Fixed
- Ensured collection slug history consistently redirects to the latest slug when titles change.
- Hardened TMDB request handling to gracefully surface retry messaging when rate limits are reached.

### Infrastructure
- Supabase SQL schema defining collections, movies cache, watch logging, social primitives, Stripe subscription tables, and storage bucket provisioning.
- Seed script for creating demo accounts, collections, and cached TMDB data to accelerate local development and QA.
