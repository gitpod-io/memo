import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Structural test: verifies the prefers-reduced-motion media query is present
 * in globals.css with the required properties (WCAG 2.1 SC 2.3.3).
 */
describe("prefers-reduced-motion media query", () => {
  const css = readFileSync(resolve(__dirname, "./globals.css"), "utf-8");

  it("includes @media (prefers-reduced-motion: reduce) rule", () => {
    expect(css).toContain(
      "@media (prefers-reduced-motion: reduce)"
    );
  });

  it("targets all elements including pseudo-elements", () => {
    expect(css).toContain("*::before");
    expect(css).toContain("*::after");
  });

  it("sets animation-duration to near-zero with !important", () => {
    expect(css).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
  });

  it("limits animation-iteration-count to 1 with !important", () => {
    expect(css).toMatch(/animation-iteration-count:\s*1\s*!important/);
  });

  it("sets transition-duration to near-zero with !important", () => {
    expect(css).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
  });

  it("disables smooth scroll-behavior with !important", () => {
    expect(css).toMatch(/scroll-behavior:\s*auto\s*!important/);
  });
});
