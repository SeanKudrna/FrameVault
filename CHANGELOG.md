# Changelog

All notable changes to FrameVault will be documented in this file.

## [Unreleased]

## [0.0.3] - 2025-09-28

### Added
- Comprehensive and robust comments added to collections-dashboard.tsx, collection-editor.tsx, supabase-provider.tsx, and billing-settings.tsx for better code documentation and maintainability.
- Personalized rationale for movie recommendations based on user preferences, displayed in movie detail views.
- Reviews section and modal for displaying TMDB reviews with enhanced TMDB data models including cast members.
- Smart picks functionality with memoized summaries, refresh capability, and improved layout in CollectionsDashboard.
- Loading states and skeleton screens for improved perceived performance across the app.
- Enhanced AGENTS documentation for new Smart Pick movie detail view and component interactions.

### Changed
- Enhanced button hover effects: text color changes to dark on hover for all button variants (default, secondary, destructive, success, warning) using `hover:!text-[#0a0a0f]`.
- Updated smart picks movie titles to change to purple color (`text-accent-primary`) on hover instead of gradient effect.
- Improved cursor pointer styles (`cursor-pointer`) for authentication buttons, landing page buttons, and sign-up toggle links to indicate clickability.
- Refactored SmartPicksCarousel to use pagination instead of index-based navigation with smoother transitions and better state management.
- Enhanced SmartPickCard layout with improved visual appeal, runtime display, and TMDB link adjustments.
- Refactored AddToCollectionForm and ProfileSettingsForm to use custom Select component for improved UI consistency and accessibility.
- Updated globals.css with enhanced design tokens and modern UI component styles.
- Revamped landing page with interactive features and polished storytelling.
- Enhanced sign-in page with persistent navigation link and improved error handling.
- Updated pricing page layout and feature comparison for better user experience.
- Improved CollectionsDashboard with keyboard navigation for SmartPickCard and better responsiveness.
- Enhanced SmartPicksCarousel and SmartPickCard components with adjusted grid structure, spacing, and genre name resolution.

### Fixed
- Stripe schedule-based downgrades now populate `pending_plan`/`next_plan`, ensuring deferred plan changes appear on the billing screen and apply automatically at renewal.
- Implemented error handling for missing authentication sessions across various components and API routes.
- Enhanced error handling for watch provider fetching and movie data retrieval.
- Improved user data fetching to gracefully handle session absence and enhance overall stability.

## [0.0.2] - 2025-09-27

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
