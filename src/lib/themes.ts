/**
 * Central theme definitions for collection customization. Stored themes persist
 * by ID so we can adjust visual tokens without migrating database entries.
 */

export interface CollectionThemeOption {
  id: string;
  label: string;
  accent: string;
  accentForeground: string;
  gradient: { from: string; via: string; to: string };
}

export const COLLECTION_THEME_OPTIONS: CollectionThemeOption[] = [
  {
    id: "indigo-dream",
    label: "Indigo Dream",
    accent: "#6366F1",
    accentForeground: "#E0E7FF",
    gradient: { from: "#312e81", via: "#1e1b4b", to: "#0f172a" },
  },
  {
    id: "crimson-noir",
    label: "Crimson Noir",
    accent: "#f97373",
    accentForeground: "#fee2e2",
    gradient: { from: "#7f1d1d", via: "#450a0a", to: "#111827" },
  },
  {
    id: "emerald-glow",
    label: "Emerald Glow",
    accent: "#34d399",
    accentForeground: "#ecfdf5",
    gradient: { from: "#064e3b", via: "#022c22", to: "#0f172a" },
  },
  {
    id: "amber-reel",
    label: "Amber Reel",
    accent: "#fbbf24",
    accentForeground: "#fef3c7",
    gradient: { from: "#7c2d12", via: "#431407", to: "#0f172a" },
  },
];

/**
 * Returns the config for a theme ID or `null` when the ID is unknown.
 */
export function getThemeConfig(themeId: string | null | undefined) {
  if (!themeId) return null;
  return COLLECTION_THEME_OPTIONS.find((option) => option.id === themeId) ?? null;
}

/**
 * Extracts the theme identifier stored in the database (typically `{ id: string }`).
 */
export function extractThemeId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = record.id;
  if (!id || typeof id !== "string") return null;
  return id;
}
