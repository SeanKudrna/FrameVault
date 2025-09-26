# AI Agent Briefing — src/app/(app)/settings

## Overview
Holds server actions and route groups that power the authenticated settings area (currently focused on profile configuration).

## Key File
- `actions.ts` exposes `updateProfileAction`, which slugifies and validates usernames, checks for conflicts, updates the `profiles` table, and revalidates dependent routes (`/settings/profile`, `/app`, and `/c/:username`).

## Update Protocol
- Document additional settings actions or subroutes here as they are introduced.
- Whenever the profile update workflow gains new fields or validation rules, record those behaviors so UI components stay aligned.
