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
const DB_CLIENT_PATH = resolve(
  __dirname,
  "../../../../components/database/database-view-client.tsx",
);

describe("[pageId] route loading state", () => {
  it("loading.tsx exists for the [pageId] route segment", () => {
    expect(existsSync(resolve(PAGE_DIR, "loading.tsx"))).toBe(true);
  });

  it("loading skeleton uses a full-width container to avoid layout shift for database pages (#682)", () => {
    const loading = readFileSync(resolve(PAGE_DIR, "loading.tsx"), "utf-8");
    // Must use full-width (no max-w-3xl) so the skeleton doesn't shift when
    // the server component renders a database page at full width
    expect(loading).toContain("mx-auto p-6");
    expect(loading).not.toContain("max-w-3xl");
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

  it("page.tsx does not use dynamic() with loading fallbacks (#666)", () => {
    const page = readFileSync(resolve(PAGE_DIR, "page.tsx"), "utf-8");
    // Convention: view components must be imported directly, not via dynamic().
    // dynamic() loading fallbacks create a second skeleton that shifts after
    // loading.tsx, causing visible layout jank during navigation.
    expect(page).not.toMatch(/\bdynamic\b/);
  });

  it("page.tsx passes initialData to DatabaseViewClient for database pages (#682)", () => {
    const page = readFileSync(resolve(PAGE_DIR, "page.tsx"), "utf-8");
    // Server component must pre-fetch database data and pass it as initialData
    // to eliminate the client-side loading skeleton that causes flicker
    expect(page).toContain("initialData={initialDatabaseData}");
    expect(page).toContain("initialDatabaseData");
  });

  it("DatabaseViewClient accepts initialData prop and skips fetch when provided (#682)", () => {
    const client = readFileSync(DB_CLIENT_PATH, "utf-8");
    // The component must accept initialData in its props interface
    expect(client).toContain("initialData");
    // When initialData is provided, loading should start as false
    expect(client).toContain("!hasInitialData");
  });
});
