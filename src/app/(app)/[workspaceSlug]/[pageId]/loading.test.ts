import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

/**
 * Regression tests for issue #160: slow navigation when clicking a page.
 *
 * The [pageId] route must have a loading.tsx so Next.js shows an instant
 * skeleton during client-side navigation instead of blocking until the
 * server component finishes fetching data.
 */

const PAGE_DIR = resolve(__dirname);

describe("[pageId] route loading state", () => {
  it("loading.tsx exists for the [pageId] route segment", () => {
    expect(existsSync(resolve(PAGE_DIR, "loading.tsx"))).toBe(true);
  });

  it("loading skeleton uses the same layout container as page-view-client", () => {
    const loading = readFileSync(resolve(PAGE_DIR, "loading.tsx"), "utf-8");
    // Must match the outer container from PageViewClient
    expect(loading).toContain("mx-auto max-w-3xl p-6");
  });

  it("loading skeleton includes animate-pulse elements", () => {
    const loading = readFileSync(resolve(PAGE_DIR, "loading.tsx"), "utf-8");
    expect(loading).toContain("animate-pulse");
  });

  it("skeleton elements use sharp corners per design spec (#165)", () => {
    const loading = readFileSync(resolve(PAGE_DIR, "loading.tsx"), "utf-8");
    // Design spec: skeletons must have sharp corners — no rounded classes
    // except the explicit exceptions listed in the Corners section.
    const lines = loading.split("\n");
    const skeletonLines = lines.filter((l) => l.includes("animate-pulse"));
    expect(skeletonLines.length).toBeGreaterThan(0);
    for (const line of skeletonLines) {
      expect(line).not.toMatch(/\brounded\b/);
    }
  });

  it("page.tsx parallelizes auth and workspace queries", () => {
    const page = readFileSync(resolve(PAGE_DIR, "page.tsx"), "utf-8");
    // The auth check and workspace lookup should run in parallel
    expect(page).toContain("Promise.all");
  });
});
