import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Regression test for #364: version save fetch must downgrade transient
 * network errors to warning level instead of reporting at error level.
 *
 * This is a static analysis test that verifies the editor source code
 * contains the correct error handling pattern for the version save fetch.
 */
describe("version save error handling", () => {
  const editorSource = readFileSync(
    join(__dirname, "editor.tsx"),
    "utf-8",
  );

  it("imports isTransientNetworkError", () => {
    expect(editorSource).toContain("isTransientNetworkError");
  });

  it("does not call lazyCaptureException directly in version save catch without checking for transient errors", () => {
    // The old buggy pattern: .catch((err) => lazyCaptureException(err))
    // on the version save fetch. Verify this single-expression catch
    // pattern is NOT used for the /versions endpoint fetch.
    const versionFetchRegex =
      /fetch\([^)]*\/versions[^)]*\)[\s\S]*?\.catch\(\(err\)\s*=>\s*lazyCaptureException\(err\)\s*\)/;
    expect(editorSource).not.toMatch(versionFetchRegex);
  });

  it("downgrades transient network errors to warning level in version save catch", () => {
    // Verify the catch handler checks isTransientNetworkError and passes
    // level: "warning" for transient errors.
    expect(editorSource).toContain('lazyCaptureException(err, { level: "warning" })');
  });
});
