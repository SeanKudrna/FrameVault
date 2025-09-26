# AI Agent Briefing — src/components/plan

## Overview
Plan-related UI lives here, providing messaging when users hit plan limits or need to upgrade.

## Key Component
- `plan-gate.tsx` (`PlanGate`): displays a lock icon, custom title/message, and an optional CTA button for viewing plans when a feature is restricted.

## Update Protocol
- Document new plan-awareness components here (e.g., upsell banners) and note how they should interact with plan helpers in `@/lib/plan`.
- When messaging conventions change, update this briefing to keep agents aware of the preferred UX.
