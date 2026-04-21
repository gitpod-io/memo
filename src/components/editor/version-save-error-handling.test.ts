import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Regression test for #384: version save fetch failures must be silently
 * dropped — no Sentry reporting at all. The page content is already saved
 * via PATCH and the next 5-minute interval will retry the version snapshot.
 *
 * Supersedes the #364 test which only downgraded to warning level.
 */
describe("version save error handling", () => {
  const editorSource = readFileSync(
    join(__dirname, "editor.tsx"),
    "utf-8",
  );

  it("does not import isTransientNetworkError (no longer needed for version saves)", () => {
    // The version save catch no longer distinguishes transient vs other errors —
    // all failures are silently dropped. The import should be removed.
    expect(editorSource).not.toContain("isTransientNetworkError");
  });

  it("does not call lazyCaptureException in the version save catch", () => {
    // Extract the version save fetch block and verify it contains no
    // lazyCaptureException call. The catch handler should only reset
    // the timer so the next save retries immediately.
    const versionFetchBlock = editorSource.match(
      /fetch\([^)]*\/versions[\s\S]*?\.catch\([\s\S]*?\)/,
    );
    expect(versionFetchBlock).not.toBeNull();
    expect(versionFetchBlock![0]).not.toContain("lazyCaptureException");
    expect(versionFetchBlock![0]).not.toContain("captureException");
  });

  it("resets lastVersionSavedAtRef on failure so the next save retries immediately", () => {
    expect(editorSource).toContain("lastVersionSavedAtRef.current = 0");
  });
});
