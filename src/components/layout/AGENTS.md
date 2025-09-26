# AI Agent Briefing — src/components/layout

## Overview
Layout-specific components that wrap authenticated screens reside here. They manage navigation, theming, and session-aware controls.

## Key Component
- `app-shell.tsx` (`AppShell`):
  - Client component providing a sidebar navigation (Dashboard, Profile) and sign-out button via Supabase provider.
  - Displays current plan, user info, and wraps main content area.
  - Applies consistent background and spacing for authenticated pages.

## Update Protocol
- Document additional layout primitives here as they are introduced.
- When navigation structure or sign-out flows change, update this briefing so route groups relying on `AppShell` remain accurate.
