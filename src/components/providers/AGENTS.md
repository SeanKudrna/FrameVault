# AI Agent Briefing — src/components/providers

## Overview
Provider components establish global React context for Supabase, React Query, and Toast notifications. Most client components assume these providers wrap the tree (the root layout mounts `AppProviders`).

## Key Components
- `app-providers.tsx` composes `ReactQueryProvider`, `ToastProvider`, and `SupabaseProvider`, passing initial session/profile from the server.
- `react-query-provider.tsx` creates a `QueryClient` per browser session and mounts devtools in non-production environments.
- `supabase-provider.tsx` instantiates the browser Supabase client, revalidates sessions via `auth.getUser()`, tracks profile state, exposes `refreshSession`/`signOut`, and responds to auth state changes.
- `toast-provider.tsx` provides a lightweight toast manager on top of Radix UI primitives, exposing `useToast` for triggering notifications.

## Update Protocol
- When adding new global providers, update `app-providers.tsx` and document them here so consumers know which contexts are available.
- Capture changes to exposed provider APIs (e.g., new Supabase context methods) to keep dependent AGENTS entries up to date.
