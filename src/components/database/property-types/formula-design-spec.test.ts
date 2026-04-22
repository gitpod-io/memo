import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Regression test for issue #494: arbitrary spacing value min-h-[60px]
 * used instead of the Tailwind spacing scale.
 */

function readSource(relativePath: string): string {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

describe("formula design spec compliance", () => {
  const source = readSource("./formula.tsx");

  it("does not use arbitrary spacing values", () => {
    // Design spec: "Never use arbitrary spacing values (p-[13px]). Use the scale."
    const arbitrarySpacing =
      /(?:min-h|max-h|h|w|min-w|max-w|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-x|space-y|inset|top|right|bottom|left)-\[\d+px\]/;
    expect(source).not.toMatch(arbitrarySpacing);
  });

  it("does not use arbitrary font sizes", () => {
    const arbitraryFontSize = /text-\[\d+px\]/;
    expect(source).not.toMatch(arbitraryFontSize);
  });
});
