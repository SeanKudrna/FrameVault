# AI Agent Briefing — src/components/profile

## Overview
Profile management UI lives here, allowing users to edit their public identity and syncing changes back to Supabase.

## Key Component
- `profile-settings-form.tsx` (`ProfileSettingsForm`):
  - Client form that edits display name and username, calling `updateProfileAction` via a React transition.
  - Updates Supabase context state, provides inline success/error messaging, and triggers toast notifications.
  - Applies input validation (slug pattern) and shows the resulting public URL.

## Update Protocol
- Document additional profile components here as they appear (avatars, billing settings, etc.).
- When the form collects new fields or changes validation, update this summary and ensure the corresponding server action documentation stays aligned.
