# AI Agent Briefing — src/app/api/export

## Overview
Helpers shared by the CSV/JSON export routes live here. `shared.ts` validates auth, enforces plan gating + rate limits, and loads the export payload via `@/lib/export` before individual formatters stream responses.

## Update Protocol
- Adjust `prepareExportPayload` whenever export eligibility changes (plan requirements, rate limits, payload shape).
- Keep format-specific routes (`export.csv`, `export.json`) lightweight by doing heavy lifting here.
