# AI Agent Briefing — src/app/(app)/settings/profile

## Overview
This route renders the profile settings UI at `/settings/profile`, allowing authenticated users to control their public handle and display name.

## Key File
- `page.tsx` gates access (redirecting unauthenticated users to sign-in and incomplete profiles to onboarding), fetches the active profile, and renders `ProfileSettingsForm` with the data.

## Integration Notes
- Depends on Supabase server client for data fetches and on `ProfileSettingsForm` for client-side interactions.
- Redirect query `?onboarding=1` signals first-time setup flows.

## Update Protocol
- Note any new settings blocks, onboarding flows, or redirect paths here when they change.
- If `ProfileSettingsForm` props evolve, update this briefing to describe the new expectations.
