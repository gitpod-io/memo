import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Regression test for issue #420: loading spinner used instead of skeleton,
 * and remove button below minimum 44px touch target.
 */

function readSource(relativePath: string): string {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

describe("feedback-form design spec compliance", () => {
  const source = readSource("./feedback-form.tsx");

  it("does not use loading spinners (design spec: use skeletons)", () => {
    expect(source).not.toContain("animate-spin");
    expect(source).not.toMatch(/Loader2/);
  });

  it("uses skeleton style for loading states", () => {
    expect(source).toContain("animate-pulse");
    expect(source).toContain("bg-muted");
  });

  it("remove screenshot button has a 44px touch target", () => {
    // Design spec: "Touch targets: minimum 44px on mobile."
    // h-11 w-11 = 44px × 44px via a ::before pseudo-element.
    expect(source).toMatch(/before:h-11/);
    expect(source).toMatch(/before:w-11/);
  });
});

describe("feedback-form stories design spec compliance", () => {
  const source = readSource("./feedback-form.stories.tsx");

  it("does not use loading spinners", () => {
    expect(source).not.toContain("animate-spin");
    expect(source).not.toMatch(/Loader2/);
  });

  it("remove screenshot button has a 44px touch target", () => {
    expect(source).toMatch(/before:h-11/);
    expect(source).toMatch(/before:w-11/);
  });
});
