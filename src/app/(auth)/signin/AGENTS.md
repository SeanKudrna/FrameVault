# AI Agent Briefing — src/app/(auth)/signin

## Overview
Another legacy alias that normalizes `/signin` requests to the canonical `/auth/sign-in` route.

## Key File
- `page.tsx` redirects immediately to `/auth/sign-in` via Next.js `redirect`.

## Update Protocol
- Capture any future changes to alias targets or deprecation strategy here.
- Coordinate with other auth aliases when modifying redirect logic to avoid loops or conflicting destinations.
