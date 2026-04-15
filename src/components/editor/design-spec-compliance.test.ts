import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Regression tests for issue #64: UI does not match design spec after PR #59.
 *
 * These tests verify that editor plugin source files comply with the design
 * spec constraints. They catch violations at the source level since the
 * plugins manipulate DOM directly and aren't easily unit-testable.
 */

function readSource(relativePath: string): string {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

describe("callout-plugin design spec compliance", () => {
  const source = readSource("./callout-plugin.tsx");

  it("callout emoji does not use text-base (not in typography scale)", () => {
    // The typography scale does not include text-base. Emoji should use
    // text-lg or text-sm per the design spec.
    const emojiClassMatch = source.match(
      /callout-emoji[^"]*text-base[^"]*/
    );
    expect(emojiClassMatch).toBeNull();
  });

  it("callout emoji uses an allowed typography size", () => {
    const emojiClassLine = source.match(
      /callout-emoji[^"]*?(text-(?:sm|lg|xl|2xl|3xl))/
    );
    expect(emojiClassLine).not.toBeNull();
  });
});

describe("draggable-block-plugin design spec compliance", () => {
  const source = readSource("./draggable-block-plugin.tsx");

  it("drag handle does not use transition classes (hover states must be instant)", () => {
    // Design spec: "Hover states: no transition (instant)."
    // The drag handle className must not include transition-opacity or duration-*.
    const menuClassMatch = source.match(
      /DRAGGABLE_BLOCK_MENU_CLASSNAME[^`]*transition-opacity/
    );
    expect(menuClassMatch).toBeNull();
  });

  it("dragging element applies scale(1.02) per drag-and-drop spec", () => {
    // Design spec: "Dragging: element at 50% opacity, slight scale (scale-[1.02]), shadow-lg."
    expect(source).toContain('style.transform = "scale(1.02)"');
  });

  it("dragging element applies shadow-lg equivalent per drag-and-drop spec", () => {
    // The shadow-lg value from Tailwind's theme
    expect(source).toContain("style.boxShadow");
    expect(source).toContain("0 10px 15px -3px");
  });

  it("drag end resets transform and boxShadow", () => {
    expect(source).toContain('style.transform = ""');
    expect(source).toContain('style.boxShadow = ""');
  });
});
