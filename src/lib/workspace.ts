// Workspace utility functions: slug generation, validation.

/**
 * Generate a URL-safe slug from a workspace name.
 * Lowercases, replaces non-alphanumeric chars with hyphens,
 * collapses consecutive hyphens, trims leading/trailing hyphens,
 * and appends a 6-char random suffix for uniqueness.
 */
export function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const suffix = Math.random().toString(36).substring(2, 8);
  return base ? `${base}-${suffix}` : suffix;
}

/**
 * Validate a workspace slug: lowercase alphanumeric + hyphens,
 * 3–60 chars, no leading/trailing hyphens.
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug);
}

/** Max workspaces a user can create (personal + 2 additional). */
export const WORKSPACE_LIMIT = 3;
