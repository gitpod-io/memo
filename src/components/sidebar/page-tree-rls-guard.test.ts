import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Regression test for issue #455: captureSupabaseError calls for
 * page-tree:create-page and page-tree:add-favorite must be guarded by
 * isInsufficientPrivilegeError to prevent RLS violations (PostgreSQL 42501)
 * from flooding Sentry with warnings.
 *
 * These operations trigger RLS violations when users hit workspace page
 * limits (e.g. E2E test workspaces). The user already sees a toast error,
 * so Sentry reporting is noise.
 */

const GUARDED_OPERATIONS = [
  "page-tree:create-page",
  "page-tree:add-favorite",
];

describe("page-tree RLS error guard", () => {
  const filePath = join(__dirname, "page-tree.tsx");
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  it("imports isInsufficientPrivilegeError from @/lib/sentry", () => {
    expect(content).toMatch(
      /import\s*\{[^}]*isInsufficientPrivilegeError[^}]*\}\s*from\s*["']@\/lib\/sentry["']/,
    );
  });

  for (const op of GUARDED_OPERATIONS) {
    it(`${op} is guarded by isInsufficientPrivilegeError`, () => {
      const lineIndex = lines.findIndex(
        (l) =>
          l.includes("captureSupabaseError(") && l.includes(`"${op}"`),
      );

      // The operation must exist in the file (or was removed — skip)
      if (lineIndex === -1) return;

      const context = lines
        .slice(Math.max(0, lineIndex - 5), lineIndex + 1)
        .join("\n");

      expect(
        context,
        `captureSupabaseError for "${op}" at line ${lineIndex + 1} must be guarded by isInsufficientPrivilegeError`,
      ).toContain("isInsufficientPrivilegeError");
    });
  }
});
