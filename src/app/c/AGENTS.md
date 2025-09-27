# AI Agent Briefing — src/app/c

## Overview
Route group hosting public collection pages accessed via `/c/:username/...`. These pages are SEO-friendly and do not require authentication.
The username index (`/c/:username`) now surfaces curator profiles with follow counts and public shelves.

## Structure
- `[username]/` nested routes resolve specific users and their public collections.

## Update Protocol
- Document any additional public surfaces added under this group (e.g., `/c/:username` index pages) in this file and the corresponding subfolder briefings.
