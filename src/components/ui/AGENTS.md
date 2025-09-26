# AI Agent Briefing — src/components/ui

## Overview
Core UI primitives used throughout the app live here. They wrap Radix or basic HTML elements with design system styling.

## Key Components
- `button.tsx`: class-variance-authority powered button variants (`default`, `muted`, `ghost`, `outline`, `destructive`) + sizes including `icon` for square actions.
- `input.tsx` and `textarea.tsx`: styled form inputs respecting dark theme and focus states.
- `toast.tsx`: Radix Toast wrappers that define toast variants (`default`, `success`, `error`, `info`), layout, and close behavior.

## Update Protocol
- Document new primitives or variant changes here; ensure any contract shifts (props, class names) are reflected in consuming component briefings.
- Maintain consistency with design guidelines—update this overview when visual conventions change so agents stay aligned.
