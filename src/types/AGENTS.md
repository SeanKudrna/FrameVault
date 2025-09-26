# AI Agent Briefing — src/types

## Overview
Shared TypeScript interfaces that sit above raw Supabase types live here. Use them for component props and server action results that need richer structures.

## Key File
- `collection.ts` defines:
  - `CollectionWithItems`: a collection alongside owner info and enriched items.
  - `CollectionItemWithMovie`: extends `collection_items` rows with optional movie metadata (`MovieSummary` or cached Supabase movie rows).

## Update Protocol
- When introducing new shared types or updating existing ones (e.g., adding fields to `CollectionItemWithMovie`), record the changes here and notify component AGENTS that consume them.
- Keep these types synchronized with schema changes to avoid drift between TS contracts and database reality.
