import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

/**
 * Static analysis tests for error handling conventions (Issue #80).
 *
 * Scans source files for bare `catch {}` blocks and `console.error` calls
 * without accompanying Sentry capture. Files that will be fixed in subsequent
 * PRs are allowlisted — those PRs must remove their file from the allowlist.
 */

const SRC_DIR = join(__dirname, "..");

/** Files with intentional bare `catch {}` that are permanently allowed. */
const BARE_CATCH_PERMANENT_ALLOWLIST = new Set([
  "src/lib/supabase/server.ts", // cookie setAll in Server Components
  "src/components/editor/editor.tsx", // URL validation (new URL() throws)
  "src/app/api/health/route.ts", // intentionally silent, monitored externally
  "src/components/members/invite-form.tsx", // clipboard writeText — intentionally silent on permission denied
  "src/components/members/pending-invite-list.tsx", // clipboard writeText — intentionally silent on permission denied
]);

/**
 * Files with bare `catch {}` that will be fixed in subsequent PRs.
 * Each entry should reference the issue that will fix it.
 */
const BARE_CATCH_PENDING_ALLOWLIST = new Set<string>([
]);

const BARE_CATCH_ALLOWLIST = new Set([
  ...BARE_CATCH_PERMANENT_ALLOWLIST,
  ...BARE_CATCH_PENDING_ALLOWLIST,
]);

/**
 * Files with `console.error` without Sentry capture that will be fixed
 * in subsequent PRs.
 */
const CONSOLE_ERROR_PENDING_ALLOWLIST = new Set<string>([
]);

function collectTsFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(d: string) {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
        files.push(full);
      }
    }
  }

  walk(dir);
  return files;
}

function toRelative(absPath: string): string {
  return relative(join(SRC_DIR, ".."), absPath);
}

describe("error handling conventions", () => {
  const files = collectTsFiles(SRC_DIR);

  it("no bare catch {} outside the allowlist", () => {
    const violations: string[] = [];

    for (const file of files) {
      const rel = toRelative(file);
      if (BARE_CATCH_ALLOWLIST.has(rel)) continue;

      const content = readFileSync(file, "utf-8");
      // Match `catch {` or `catch  {` (bare catch without error variable)
      // but not `catch (error)` or `catch (e)`
      const bareCatchPattern = /\bcatch\s*\{/g;
      let match;
      while ((match = bareCatchPattern.exec(content)) !== null) {
        const line = content.slice(0, match.index).split("\n").length;
        violations.push(`${rel}:${line}`);
      }
    }

    expect(
      violations,
      `Bare catch {} found outside allowlist. Either capture the error and report to Sentry, or add to the allowlist with a comment explaining why:\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("no console.error without Sentry capture outside the allowlist", () => {
    const violations: string[] = [];

    for (const file of files) {
      const rel = toRelative(file);
      if (CONSOLE_ERROR_PENDING_ALLOWLIST.has(rel)) continue;

      const content = readFileSync(file, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("console.error")) {
          // Check if Sentry capture exists anywhere in the same file
          const hasSentryCapture =
            content.includes("Sentry.captureException") ||
            content.includes("captureSupabaseError");

          if (!hasSentryCapture) {
            violations.push(`${rel}:${i + 1}`);
          }
        }
      }
    }

    expect(
      violations,
      `console.error without Sentry capture found outside allowlist. Add Sentry.captureException or captureSupabaseError:\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("no Supabase error .message exposed to users without Sentry capture", () => {
    /**
     * Detects patterns like `setError(someError.message)` where a Supabase
     * error message is shown directly to the user. These leak internal
     * details (e.g. RLS policy names, SQL errors) and bypass Sentry.
     *
     * Allowed patterns:
     * - The file imports and calls captureSupabaseError before setError
     * - The error message is checked for a known string first (e.g.
     *   `if (error.message.includes("Workspace limit"))`)
     *
     * Auth forms (sign-in, sign-up) are excluded — Supabase Auth error
     * messages are designed to be user-facing (e.g. "Invalid login credentials").
     */
    const AUTH_FORM_ALLOWLIST = new Set([
      "src/app/(auth)/sign-in/sign-in-form.tsx",
      "src/app/(auth)/sign-up/sign-up-form.tsx",
    ]);

    const violations: string[] = [];

    // Matches setError(identifier.message) — the raw error leak pattern
    const rawErrorPattern = /\bsetError\(\s*\w+(?:Error)?\s*\.\s*message\s*\)/g;

    for (const file of files) {
      const rel = toRelative(file);
      if (AUTH_FORM_ALLOWLIST.has(rel)) continue;

      const content = readFileSync(file, "utf-8");

      // Skip files that don't use setError at all
      if (!content.includes("setError")) continue;

      rawErrorPattern.lastIndex = 0;
      let match;

      while ((match = rawErrorPattern.exec(content)) !== null) {
        const lineNum = content.slice(0, match.index).split("\n").length;
        const hasSentryCapture = content.includes("captureSupabaseError");

        if (!hasSentryCapture) {
          violations.push(`${rel}:${lineNum}`);
        }
      }
    }

    expect(
      violations,
      `Raw Supabase error.message exposed to users without captureSupabaseError. ` +
        `Use captureSupabaseError() to report to Sentry and show a generic message instead:\n${violations.join("\n")}`,
    ).toEqual([]);
  });
});
