import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Regression tests for issue #186: UI does not match design spec after PR #185.
 *
 * These tests verify that emoji-picker and page-icon source files comply with
 * the design spec constraints for touch targets, input styling, mobile
 * visibility, and responsive width.
 */

function readSource(relativePath: string): string {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

describe("emoji-picker design spec compliance", () => {
  const source = readSource("./emoji-picker.tsx");

  it("emoji buttons have 44px minimum touch target on mobile", () => {
    // Design spec: "Touch targets: minimum 44px on mobile."
    // Emoji buttons must use min-h-[44px] and min-w-[44px] for mobile.
    expect(source).toContain("min-h-[44px]");
    expect(source).toContain("min-w-[44px]");
  });

  it("filter input has border per input spec", () => {
    // Design spec: Inputs should have border-white/[0.06] border.
    const precedingClass = source.match(
      /className="[^"]*border border-white\/\[0\.06\][^"]*"[\s\S]*?aria-label="Filter emojis"/
    );
    expect(precedingClass).not.toBeNull();
  });

  it("filter input has focus ring per input spec", () => {
    // Design spec: Inputs should have ring-2 ring-ring on focus.
    const inputSection = source.match(
      /className="[^"]*"[\s\S]*?aria-label="Filter emojis"/
    );
    expect(inputSection).not.toBeNull();
    expect(inputSection![0]).toContain("focus:ring-2");
    expect(inputSection![0]).toContain("focus:ring-ring");
  });

  it("picker uses responsive width to avoid mobile clipping", () => {
    // Design spec: "No horizontal scroll on any breakpoint."
    // The picker must not use a fixed w-72 without a mobile-responsive alternative.
    expect(source).toContain("sm:w-72");
    // Must have a viewport-relative width for mobile
    expect(source).toMatch(/w-\[calc\(100vw/);
  });
});

describe("page-icon design spec compliance", () => {
  const source = readSource("./page-icon.tsx");

  it("page icon button has 44px minimum touch target on mobile", () => {
    // Design spec: "Touch targets: minimum 44px on mobile."
    expect(source).toContain("min-h-[44px]");
    expect(source).toContain("min-w-[44px]");
  });

  it("add-icon button is visible on mobile (not hover-only)", () => {
    // Design spec: Touch targets must be accessible on mobile.
    // The button container must not rely solely on group-hover for visibility.
    // It should use max-sm:opacity-100 or similar to be visible on touch devices.
    expect(source).toContain("max-sm:opacity-100");
  });

  it("add-icon button has 44px minimum touch target on mobile", () => {
    // The "Add icon" button must meet the 44px minimum on mobile.
    const addIconSection = source.match(
      /aria-label="Add page icon"[\s\S]{0,50}/
    );
    expect(addIconSection).not.toBeNull();

    const classSection = source.match(
      /className="[^"]*min-h-\[44px\][^"]*"[\s\S]*?aria-label="Add page icon"/
    );
    expect(classSection).not.toBeNull();
  });
});
