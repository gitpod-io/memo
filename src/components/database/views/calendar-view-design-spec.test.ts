import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Regression test for issue #488: the overflow popover in the calendar view
 * must use `rounded-sm` per the design spec for floating elements.
 */
describe("calendar-view design spec compliance", () => {
  const source = readFileSync(join(__dirname, "calendar-view.tsx"), "utf-8");

  it("overflow popover uses rounded-sm", () => {
    // Design spec Corners section:
    // "Exceptions (use rounded-sm only): Dropdown menus and popovers
    //  (floating elements need a slight radius to feel intentional)."
    const lines = source.split("\n");
    const popoverLines = lines.filter(
      (line) =>
        line.includes("z-50") &&
        line.includes("shadow-md") &&
        line.includes("bg-background"),
    );

    expect(popoverLines.length).toBeGreaterThan(0);
    for (const line of popoverLines) {
      expect(line).toContain("rounded-sm");
    }
  });
});
