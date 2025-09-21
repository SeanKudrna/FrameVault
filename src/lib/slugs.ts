export function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .replace(/-{2,}/g, "-");
}

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
