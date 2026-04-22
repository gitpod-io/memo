import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Regression test for issue #476: skeleton text bars in PersonEditor
 * used `rounded` (4px border-radius) instead of sharp corners.
 *
 * Design spec: sharp corners by default. Only dropdown menus/popovers,
 * toasts, and code blocks may use `rounded-sm`. Skeleton bars are not
 * in the exception list.
 */

function readSource(relativePath: string): string {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

describe("PersonEditor skeleton design spec compliance", () => {
  const source = readSource("./person.tsx");

  it("skeleton text bars do not use border-radius", () => {
    // Extract lines that are skeleton text bars (animate-pulse bg-muted,
    // but NOT rounded-full which is correct for avatar circles).
    const skeletonLines = source
      .split("\n")
      .filter(
        (line) =>
          line.includes("animate-pulse") &&
          line.includes("bg-muted") &&
          !line.includes("rounded-full"),
      );

    for (const line of skeletonLines) {
      // Should not contain `rounded` (standalone class, not rounded-full or rounded-sm on exceptions)
      expect(line).not.toMatch(/\brounded\b(?!-)/);
    }
  });
});
