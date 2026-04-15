/**
 * Generate a URL-safe slug from a workspace name.
 * Lowercases, replaces non-alphanumeric chars with hyphens,
 * collapses consecutive hyphens, and trims leading/trailing hyphens.
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Validate a workspace slug: lowercase alphanumeric + hyphens,
 * 2–48 chars, no leading/trailing hyphens.
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,46}[a-z0-9]$/.test(slug) || /^[a-z0-9]{1,2}$/.test(slug);
}

/** Max workspaces a user can create (personal + 2 additional). */
export const MAX_CREATED_WORKSPACES = 3;
