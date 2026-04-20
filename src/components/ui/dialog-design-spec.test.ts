import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Regression tests for issue #266: dialog component uses rounded corners
 * instead of sharp corners required by the design spec.
 *
 * Design spec (Corners section):
 * "Everything else — buttons, inputs, cards, sidebar items, dialogs, sheets —
 *  uses sharp corners."
 *
 * Only dropdown menus, popovers, toast notifications, and code blocks may use
 * rounded-sm. Dialogs must have sharp corners (no border-radius).
 */

function readSource(relativePath: string): string {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

describe("dialog design spec compliance", () => {
  const source = readSource("./dialog.tsx");

  it("DialogContent does not use rounded corners", () => {
    // Extract the className string for DialogContent (data-slot="dialog-content")
    const contentMatch = source.match(
      /data-slot="dialog-content"[\s\S]*?className=\{cn\(\s*"([^"]+)"/
    );
    expect(contentMatch).not.toBeNull();
    const classes = contentMatch![1];
    expect(classes).not.toMatch(/rounded/);
  });

  it("DialogFooter does not use rounded corners", () => {
    // Extract the className string for DialogFooter (data-slot="dialog-footer")
    const footerMatch = source.match(
      /data-slot="dialog-footer"[\s\S]*?className=\{cn\(\s*"([^"]+)"/
    );
    expect(footerMatch).not.toBeNull();
    const classes = footerMatch![1];
    expect(classes).not.toMatch(/rounded/);
  });

  it("DialogOverlay does not use rounded corners", () => {
    const overlayMatch = source.match(
      /data-slot="dialog-overlay"[\s\S]*?className=\{cn\(\s*"([^"]+)"/
    );
    expect(overlayMatch).not.toBeNull();
    const classes = overlayMatch![1];
    expect(classes).not.toMatch(/rounded/);
  });
});
