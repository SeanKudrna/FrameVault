# Changelog

All notable changes to FrameVault will be documented in this file.

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
