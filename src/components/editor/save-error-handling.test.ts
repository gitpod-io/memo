import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Regression test for #485 / Sentry MEMO-E: editor save errors must use
 * captureSupabaseError (not lazyCaptureException) so transient network
 * errors are classified at warning level instead of error level.
 */
describe("editor save error handling", () => {
  const editorSource = readFileSync(
    join(__dirname, "editor.tsx"),
    "utf-8",
  );

  it("imports captureSupabaseError and isInsufficientPrivilegeError from @/lib/sentry", () => {
    expect(editorSource).toContain("captureSupabaseError");
    expect(editorSource).toContain("isInsufficientPrivilegeError");
    expect(editorSource).toMatch(
      /import\s*\{[^}]*captureSupabaseError[^}]*\}\s*from\s*["']@\/lib\/sentry["']/,
    );
  });

  it("uses captureSupabaseError for the page save error path", () => {
    // The save error path should call captureSupabaseError with "editor:save"
    expect(editorSource).toContain(
      'captureSupabaseError(error, "editor:save")',
    );
  });

  it("uses captureSupabaseError for the syncPageLinks error path", () => {
    // The page links sync catch should use captureSupabaseError
    expect(editorSource).toContain(
      'captureSupabaseError(err, "editor:sync-page-links")',
    );
  });

  it("guards RLS violations before captureSupabaseError in the save path", () => {
    // The save error path should check isInsufficientPrivilegeError before
    // calling captureSupabaseError, so expected RLS rejections are not reported.
    expect(editorSource).toContain("isInsufficientPrivilegeError(error)");
  });

  it("does not use lazyCaptureException for Supabase errors", () => {
    // lazyCaptureException should only appear for the Lexical onError handler,
    // not for any Supabase error path. Extract all lazyCaptureException calls
    // and verify none are in Supabase error contexts.
    const lines = editorSource.split("\n");
    const lazyCalls = lines
      .map((line, i) => ({ line: line.trim(), lineNum: i + 1 }))
      .filter(
        ({ line }) =>
          line.includes("lazyCaptureException(") &&
          !line.startsWith("import") &&
          !line.startsWith("//"),
      );

    // Only the Lexical onError handler should use lazyCaptureException
    for (const { line } of lazyCalls) {
      expect(line).not.toContain("editor:save");
      expect(line).not.toContain("editor:sync");
    }
  });
});
