import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Regression test for issue #47: dialog overlays must use bg-black/50
 * per the design spec. bg-black/10 is nearly invisible and breaks
 * the modal focus effect.
 */
describe("dialog overlay opacity matches design spec", () => {
  const uiDir = join(__dirname);

  it("DialogOverlay uses bg-black/50", () => {
    const source = readFileSync(join(uiDir, "dialog.tsx"), "utf-8");
    expect(source).toContain("bg-black/50");
    expect(source).not.toContain("bg-black/10");
  });

  it("AlertDialogOverlay uses bg-black/50", () => {
    const source = readFileSync(join(uiDir, "alert-dialog.tsx"), "utf-8");
    expect(source).toContain("bg-black/50");
    expect(source).not.toContain("bg-black/10");
  });
});
