# Movies Route AGENT

- `[tmdbId]/page.tsx`: server-rendered movie detail view used by Smart Picks and future discovery entry points. Loads the TMDB movie summary via `getMovieSummaryById`, fetches the viewer's collections for quick adds, and hydrates watch provider data with `fetchWatchProviders`.
- The page renders `AddToCollectionForm`, so updates to that form or the collections server action should be reflected here.
- If additional movie subroutes (e.g., reviews) are introduced, document them in this file and update the parent `(app)` agent summary.
