import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Regression test for issue #1459: browser extensions and mobile browsers
 * inject attributes/elements into <html> and <body>, causing React hydration
 * mismatches. Both elements must carry suppressHydrationWarning.
 */
describe("root layout hydration safety", () => {
  const layoutSource = readFileSync(join(__dirname, "layout.tsx"), "utf-8");

  it("<html> has suppressHydrationWarning", () => {
    // Match <html with suppressHydrationWarning before the closing >
    expect(layoutSource).toMatch(/<html[\s\S]*?suppressHydrationWarning[\s\S]*?>/);
  });

  it("<body> has suppressHydrationWarning", () => {
    expect(layoutSource).toMatch(/<body[\s\S]*?suppressHydrationWarning[\s\S]*?>/);
  });
});
