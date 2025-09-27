# AI Agent Briefing — src/components/collections

## Overview
Contains all UI related to managing collections: dashboards, server-action orchestration, drag-and-drop editors, and supporting controls. Components here assume authenticated usage and integrate tightly with Supabase server actions.

## Key Components
- `collections-dashboard.tsx`:
  - Renders the `/app` grid view with create buttons, plan gating, and `CollectionCard` interactions.
  - Invokes server actions (`createCollectionAction`, `updateCollectionDetailsAction`, `deleteCollectionAction`) and handles toast feedback.
  - `CollectionCard` manages navigation to editors, hover menu triggers, and rename/public toggle flows.
- `collection-editor.tsx`:
  - Implements the full collection editing workspace, including item reordering (drag-and-drop), TMDB search integration, note editing, and publish toggles.
  - Calls server actions (`addMovieToCollectionAction`, `removeCollectionItemAction`, `reorderCollectionItemsAction`, `updateCollectionDetailsAction`, `updateCollectionItemNoteAction`).
  - Coordinates optimistic updates, plan gating, and view status toggles (Watched/Watching/Want) which sync with `setViewStatusAction` and the `/app/history` timeline.
  - Surfaces Plus-only customization (cover uploads via `uploadCollectionCoverAction`, theme selection persisted through `updateCollectionDetailsAction`).
- `public-share-actions.tsx`: client-side share button used on the public collection page. Attempts Web Share first, falling back to copy-to-clipboard with toast feedback.

## Integration Notes
- Components rely on shared providers (toast, Supabase) and UI primitives.
- `CollectionItem` types come from `@/types/collection` to keep item/movie data consistent.

## Update Protocol
- Document new components (e.g., modals, metrics panels) or major prop changes here.
- If server action contracts change, update summaries to reflect new arguments/side effects and ensure parent route AGENTS are synchronized.
