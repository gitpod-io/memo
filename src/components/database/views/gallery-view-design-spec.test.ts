import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Regression tests for issue #507: gallery view design spec compliance.
 *
 * Verifies that the gallery view follows the design spec for:
 * - Icon-only buttons must have aria-label
 * - Empty states must have icon + heading + description (not bare text)
 */

function readSource(): string {
  return readFileSync(resolve(__dirname, "./gallery-view.tsx"), "utf-8");
}

describe("gallery-view design spec compliance", () => {
  const source = readSource();

  it("icon-only add button has aria-label", () => {
    // Design spec (.agents/design.md → Components → Buttons):
    // "Icon-only buttons: use size='icon' variant, always include aria-label."
    // The Plus-icon button must have an aria-label for accessibility.
    expect(source).toMatch(/aria-label="Add new page"/);
  });

  it("read-only empty state has icon, heading, and description", () => {
    // Design spec (.agents/design.md → Empty Database):
    // "Centered empty state within the database grid area."
    // "Icon: ... 48px, text-muted-foreground."
    // "Heading: text-lg font-medium"
    // "Description: text-sm text-muted-foreground"
    // Must NOT be bare text like "No pages in this gallery".
    expect(source).not.toMatch(
      /className="[^"]*items-center[^"]*">\s*No pages in this gallery/,
    );

    // The empty state (rows.length === 0 && !onAddRow) must render an icon
    expect(source).toMatch(/LayoutGrid\s+className="h-12 w-12/);

    // Must have a heading with text-lg font-medium
    expect(source).toMatch(/text-lg font-medium/);

    // Must have a description with text-sm text-muted-foreground
    expect(source).toMatch(
      /className="text-sm text-muted-foreground"[\s\S]*?gallery/,
    );
  });
});
