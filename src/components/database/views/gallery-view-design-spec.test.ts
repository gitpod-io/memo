import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Regression tests for issue #507: gallery view design spec compliance.
 *
 * Verifies that the gallery view follows the design spec for:
 * - Icon-only buttons must have aria-label
 * - Empty states must have icon + heading + description (not bare text)
 *
 * The empty state is now delegated to the shared DatabaseEmptyState component
 * (introduced in #770). These tests verify the gallery view uses it correctly
 * and that DatabaseEmptyState itself meets the design spec.
 */

function readGallerySource(): string {
  return readFileSync(resolve(__dirname, "./gallery-view.tsx"), "utf-8");
}

function readEmptyStateSource(): string {
  return readFileSync(resolve(__dirname, "./database-empty-state.tsx"), "utf-8");
}

describe("gallery-view design spec compliance", () => {
  const gallerySource = readGallerySource();
  const emptyStateSource = readEmptyStateSource();

  it("icon-only add button has aria-label", () => {
    // Design spec (.agents/design.md → Components → Buttons):
    // "Icon-only buttons: use size='icon' variant, always include aria-label."
    // The Plus-icon button must have an aria-label for accessibility.
    expect(gallerySource).toMatch(/aria-label="Add new page"/);
  });

  it("read-only empty state delegates to DatabaseEmptyState", () => {
    // Gallery view must NOT use bare text for empty states — it delegates
    // to the shared DatabaseEmptyState component.
    expect(gallerySource).not.toMatch(
      /className="[^"]*items-center[^"]*">\s*No pages in this gallery/,
    );

    // Gallery view imports and uses DatabaseEmptyState
    expect(gallerySource).toMatch(/DatabaseEmptyState/);
  });

  it("DatabaseEmptyState has icon, heading, and description", () => {
    // Design spec (.agents/design.md → Empty Database):
    // "Centered empty state within the database grid area."
    // "Icon: Table2 from lucide-react, 48px, text-muted-foreground."
    // The empty state must render an icon (Table2 for no-rows, FilterX for filtered)
    expect(emptyStateSource).toMatch(/Table2\s+className="/);
    expect(emptyStateSource).toMatch(/FilterX\s+className="/);

    // Must have a description with text-sm text-muted-foreground
    expect(emptyStateSource).toMatch(/text-sm text-muted-foreground/);
  });
});
