# AI Agent Briefing — src/app/(app)/collections/[collectionId]

## Overview
This dynamic route serves the authenticated collection editor (`/collections/:collectionId`). It loads all data required to render the drag-and-drop editor experience.

## Key File
- `page.tsx` performs server-side fetches:
  - Ensures the user is signed in and has an initialized profile.
  - Loads the requested collection, verifying ownership and pulling item rows.
  - Fetches cached TMDB movie metadata to enrich items (overview, posters, vote average).
  - Maps results into `CollectionItemWithMovie` objects consumed by `CollectionEditor`.
  - Redirects or 404s when access rules fail.

## Integration Notes
- Uses `@/components/collections/collection-editor` for the UI and relies on Supabase tables `collections`, `collection_items`, and `movies`.
- Maintains slug history by passing `previous_slugs` to the editor so actions can manage redirects.

## Update Protocol
- If additional data is loaded (notes, theme data, etc.), note it here and in the editor component briefing.
- Document any changes to redirect/onboarding behavior to keep navigation logic clear.
