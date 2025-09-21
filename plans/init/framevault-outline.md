# Movie Portfolio Web App

## Overview
The Movie Portfolio Web App is a web-based platform for movie enthusiasts to curate, organize, and showcase their personal movie collections. Unlike traditional movie logging apps, this platform emphasizes **personal curation** through themed collections, offering users a unique way to express their cinematic taste and discover new films through others’ portfolios.

The platform will operate on a **tiered SaaS model**, offering a free experience with essential features and premium tiers that unlock customization, advanced recommendations, and integrations.

---

## Core Features

### Personal Movie Collections
- Create and customize themed movie “shelves” or portfolios (e.g., *Rainy Day Films*, *My Top 10 Thrillers*, *Cozy Fall Movies*).
- Add notes, tags, and ratings to movies in each collection.
- Drag-and-drop ordering of films within a collection.

### Movie Logging
- Track all movies you’ve watched.
- Mark movies as “Watched,” “Want to Watch,” or “Currently Watching.”
- Generate a personal timeline of viewing history.

### Social Features
- Share collections with friends or keep them private.
- Follow other users and explore their curated collections.
- Comment or react on collections to spark discussions.

---

## Tiered Structure

### Free Tier
- Create up to **5 collections**.
- Log unlimited movies with basic watchlist functionality.
- Browse other users’ collections (read-only).

### Plus Tier (e.g., $4.99/month)
- Unlimited collections.
- Advanced customization: custom cover images, collection descriptions, themes.
- Ability to follow unlimited users and get personalized recommendations based on overlaps.
- Export movie data (CSV/JSON).

### Pro Tier (e.g., $9.99/month)
- AI-powered movie recommendations tailored to collections and viewing history.
- Streaming integration (e.g., see where movies are currently available).
- Collaborative collections (friends can co-curate a shelf).
- Analytics dashboard (stats like “Genres you watch most,” “Directors you revisit,” “Your top actors”).
- Priority feature access and beta testing of new tools.

---

## Monetization & Growth
- **Freemium Upsell:** Showcase features locked behind Plus/Pro tiers (e.g., “Unlock unlimited collections”).
- **Community Hooks:** Encourage sharing curated collections on social media to drive organic growth.
- **Affiliate Streaming Links:** Monetize through partnerships with streaming services when showing where to watch films.

---

## Tech Stack (Draft)
- **Frontend:** React (Next.js or Remix), Tailwind CSS, Framer Motion for animations.
- **Backend:** Node.js + Convex or Supabase for real-time sync.
- **Database:** PostgreSQL (with Prisma) or Convex Data Model.
- **Auth:** OAuth (Google, Apple, GitHub) + Magic links.
- **Integrations:** TMDB (The Movie Database) API for film data.
- **Hosting:** Vercel or Netlify for frontend, Railway/Fly.io for backend.

---

## Roadmap
### Phase 1 – MVP
- Movie logging system.
- Basic themed collections.
- TMDB integration.
- Free tier only.

### Phase 2 – Plus Tier
- Unlimited collections.
- Customization (covers, descriptions).
- Social following + discovery.
- CSV/JSON export.

### Phase 3 – Pro Tier
- AI-powered recommendations.
- Streaming availability integration.
- Collaborative collections.
- Analytics dashboard.

---

## Future Ideas
- Mobile app version (React Native).
- Seasonal events (e.g., “Halloween Horror Watchlists”).
- Gamification: badges for completing themed challenges.
- Integration with Discord/Slack for group movie nights.