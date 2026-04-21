import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Regression tests for issue #369: UI does not match design spec after PR #365.
 *
 * Verifies that workspace-home.tsx complies with the design spec for:
 * 1. Sort dropdown displaying human-readable labels (not raw values)
 * 2. Filter empty state matching the empty state pattern
 */

function readSource(relativePath: string): string {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

describe("workspace-home sort dropdown", () => {
  const source = readSource("./workspace-home.tsx");

  it("SelectValue uses a render function to display labels", () => {
    // base-ui SelectValue renders the raw value string by default.
    // A children render function is required to map values to labels.
    // Match: <SelectValue>{...}</SelectValue> (not self-closing)
    const selectValuePattern = /<SelectValue>[\s\S]*?<\/SelectValue>/;
    expect(source).toMatch(selectValuePattern);
  });

  it("SelectValue render function references SORT_LABELS", () => {
    // The render function must use the SORT_LABELS map to resolve
    // internal values like "updated_desc" to "Last modified".
    const afterSelectValue = source.slice(source.indexOf("<SelectValue>"));
    const beforeClose = afterSelectValue.slice(
      0,
      afterSelectValue.indexOf("</SelectValue>"),
    );
    expect(beforeClose).toContain("SORT_LABELS");
  });
});

describe("workspace-home filter empty state", () => {
  const source = readSource("./workspace-home.tsx");

  it("empty state icon uses 48px size (h-12 w-12)", () => {
    // Design spec: empty state icons are 48px (h-12 w-12), not 32px (h-8 w-8).
    const emptyStateSection = source.slice(
      source.indexOf("filteredAndSorted.length === 0"),
    );
    const endOfEmptyState = emptyStateSection.indexOf(") : (");
    const emptyBlock = emptyStateSection.slice(0, endOfEmptyState);

    expect(emptyBlock).toContain("h-12 w-12");
    expect(emptyBlock).not.toContain("h-8 w-8");
  });

  it("empty state includes a heading element", () => {
    // Design spec: empty states need icon + heading + description + CTA.
    const emptyStateSection = source.slice(
      source.indexOf("filteredAndSorted.length === 0"),
    );
    const endOfEmptyState = emptyStateSection.indexOf(") : (");
    const emptyBlock = emptyStateSection.slice(0, endOfEmptyState);

    // Must have an h2 or h3 heading with the design spec typography
    expect(emptyBlock).toMatch(/<h[23]\s[^>]*text-lg font-medium/);
  });

  it("empty state includes a clear filter CTA button", () => {
    // Design spec: empty states should include a CTA button.
    const emptyStateSection = source.slice(
      source.indexOf("filteredAndSorted.length === 0"),
    );
    const endOfEmptyState = emptyStateSection.indexOf(") : (");
    const emptyBlock = emptyStateSection.slice(0, endOfEmptyState);

    expect(emptyBlock).toContain("Clear filter");
    expect(emptyBlock).toContain("setFilter");
  });
});
