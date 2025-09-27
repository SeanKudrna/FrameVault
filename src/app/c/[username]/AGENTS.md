# AI Agent Briefing — src/app/c/[username]

## Overview
Provides dynamic routing context for public curator surfaces. The index route (`page.tsx`) renders the curator profile summary and trending collections, while the nested `[collectionSlug]` route resolves individual collections.

## Update Protocol
- If you introduce additional routes under a username (e.g., profile index, collection list), add documentation here describing the new behavior.
- Keep alias or redirect logic in sync with this briefing to avoid broken public links.
