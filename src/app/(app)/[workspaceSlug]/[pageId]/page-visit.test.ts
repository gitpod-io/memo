import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const SOURCE = readFileSync(resolve(__dirname, "page.tsx"), "utf-8");

describe("page visit error handling", () => {
  it("filters FK violation errors (23503) on page_visits upsert", () => {
    // Regression test for #317: page_visits upsert must not report FK
    // violations to Sentry — they occur when a workspace is deleted while
    // a page visit is in-flight and are expected, non-actionable errors.
    expect(SOURCE).toContain('error.code !== "23503"');
  });

  it("still reports non-FK errors to Sentry", () => {
    expect(SOURCE).toContain("captureSupabaseError(error, \"page-view:record-visit\")");
  });
});
