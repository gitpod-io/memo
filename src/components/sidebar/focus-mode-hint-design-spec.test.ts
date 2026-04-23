import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Regression test for issue #376: arbitrary font size text-[10px] used
 * instead of the typography scale minimum text-xs.
 */

function readSource(relativePath: string): string {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

describe("focus-mode-hint design spec compliance", () => {
  const source = readSource("./focus-mode-hint.tsx");

  it("does not use arbitrary font sizes", () => {
    // Design spec: "No font sizes outside the typography scale."
    // The typography scale is: text-xs, text-sm, text-lg, text-xl, text-2xl, text-3xl.
    // Arbitrary values like text-[10px] are not allowed.
    const arbitraryFontSize = /text-\[\d+px\]/;
    expect(source).not.toMatch(arbitraryFontSize);
  });

  it("kbd element uses text-xs from the typography scale", () => {
    // The keyboard shortcut label should use text-xs (12px), the smallest
    // allowed size in the typography scale.
    expect(source).toContain("text-xs text-label-faint");
  });
});

describe("focus-mode-hint story design spec compliance", () => {
  const source = readSource("./focus-mode-hint.stories.tsx");

  it("does not use arbitrary font sizes", () => {
    const arbitraryFontSize = /text-\[\d+px\]/;
    expect(source).not.toMatch(arbitraryFontSize);
  });
});
