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

describe("callout-node design spec compliance", () => {
  const source = readSource("./callout-node.tsx");

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

  it("callout emoji span is created in createDOM, not via mutation listener", () => {
    // The emoji must render immediately on insert, not asynchronously via
    // a mutation listener. Verify createDOM creates the emoji span.
    expect(source).toContain("createDOM");
    const createDOMIndex = source.indexOf("createDOM");
    const emojiIndex = source.indexOf("callout-emoji", createDOMIndex);
    expect(emojiIndex).toBeGreaterThan(createDOMIndex);
  });

  it("callout uses a left border to distinguish from code blocks", () => {
    // Design spec: callouts need visual distinction from code blocks.
    // A colored left border provides this.
    expect(source).toContain("border-l-2");
  });

  it("each callout variant has a distinct border color", () => {
    // All four variants must map to different border color classes
    const variantBlock = source.match(
      /VARIANT_CLASSES[\s\S]*?\{([\s\S]*?)\}/
    );
    expect(variantBlock).not.toBeNull();
    const block = variantBlock![1];
    expect(block).toContain("border-l-accent");
    expect(block).toContain("border-l-code-type");
    expect(block).toContain("border-l-code-string");
    expect(block).toContain("border-l-destructive");
  });

  it("callout plugin does not use registerMutationListener for emoji", () => {
    // Emoji rendering moved to createDOM — the plugin should not
    // manipulate DOM via mutation listeners.
    const pluginSource = readSource("./callout-plugin.tsx");
    expect(pluginSource).not.toContain("registerMutationListener");
  });
});

describe("editor anchor element", () => {
  const source = readSource("./editor.tsx");

  it("anchor div has left padding for drag handle area", () => {
    // The anchor element must extend left so the drag handle (portaled inside)
    // stays within its bounds and receives mouse events.
    expect(source).toMatch(/ref={onFloatingAnchorRef}[^>]*>/);
    expect(source).toContain("pl-8");
    expect(source).toContain("-ml-8");
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
