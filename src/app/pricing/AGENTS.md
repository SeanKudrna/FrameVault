# AI Agent Briefing — src/app/pricing

## Overview
Standalone marketing route that expands on the pricing matrix, plan descriptions, and FAQs introduced on the landing page.

## Key File
- `page.tsx`: renders the pricing hero, plan cards, feature comparison table, and FAQ blocks. CTA buttons link back into the authenticated app (e.g., `/app?upgrade=plus`).

## Update Protocol
- Keep plan copy, pricing amounts, and feature availability in sync with the billing helpers in `@/lib/billing`.
- When adding new plans or FAQ entries, update both this page and the marketing sections on the homepage to remain consistent.
