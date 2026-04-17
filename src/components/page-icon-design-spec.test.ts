import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Regression test for issue #191: the "Add icon" hover-reveal button
 * must not use transition-opacity. Design spec requires instant hover states.
 */
describe("page-icon design spec compliance", () => {
  const source = readFileSync(join(__dirname, "page-icon.tsx"), "utf-8");

  it("hover-reveal wrapper does not use transition classes", () => {
    // Design spec: "Hover states: no transition (instant)."
    // The opacity-0 → opacity-100 hover reveal must be instant.
    const lines = source.split("\n");
    const hoverRevealLines = lines.filter(
      (line) =>
        line.includes("opacity-0") &&
        line.includes("group-hover")
    );

    for (const line of hoverRevealLines) {
      expect(line).not.toContain("transition-opacity");
      expect(line).not.toMatch(/duration-\d+/);
    }
  });
});
