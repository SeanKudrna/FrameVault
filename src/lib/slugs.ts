/**
 * Slug helpers used for both public collection URLs and internal dashboards.
 * Centralising the logic ensures server actions and UI components agree on how
 * slugs are generated and deduplicated.
 */

/**
 * Produces a URL-safe slug by lowercasing, replacing ampersands, and collapsing
 * whitespace/punctuation. The resulting string is suitable for inclusion in a
 * route segment.
 */
export function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .replace(/-{2,}/g, "-");
}

/**
 * Ensures a slug is unique within the provided set by appending incrementing
 * counters when needed. The returned slug is guaranteed to not appear in the
 * `existing` collection, allowing callers to safely persist the value without a
 * second query.
 */
export function ensureUniqueSlug(base: string, existing: Set<string>) {
  const slug = slugify(base);
  if (!existing.has(slug)) return slug;

  let counter = 2;
  let candidate = `${slug}-${counter}`;
  while (existing.has(candidate)) {
    counter += 1;
    candidate = `${slug}-${counter}`;
  }
  return candidate;
}
