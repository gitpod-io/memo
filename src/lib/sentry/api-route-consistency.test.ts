import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

/**
 * Structural convention tests for API route error handling (Issue #1118).
 *
 * Validates that API routes performing Supabase mutations use the standard
 * error classification utilities (captureSupabaseError, captureApiError,
 * isForeignKeyViolationError) instead of bare console.error or unclassified
 * catch blocks. This prevents the "forgot to add the check in the new
 * endpoint" pattern that caused repeated Sentry noise bugs.
 */

const API_DIR = join(__dirname, "..", "..", "app", "api");
const PROJECT_ROOT = join(__dirname, "..", "..", "..");

/**
 * Routes that intentionally skip certain checks.
 * Each entry must have a comment explaining why.
 */
const ALLOWLIST: Record<string, string> = {
  // Health endpoint uses raw fetch (no Supabase client), no mutations,
  // and is monitored externally — intentionally silent on errors.
  "src/app/api/health/route.ts": "raw fetch health check, no Supabase client",
};

/** Mutation method patterns — calls that write data. */
const MUTATION_PATTERN = /\.(?:insert|update|delete|upsert)\s*\(/;

/** Supabase .from() call pattern — indicates Supabase table access. */
const FROM_CALL_PATTERN = /\.from\s*\(/;

/** Supabase .rpc() call pattern — indicates Supabase RPC access. */
const RPC_CALL_PATTERN = /\.rpc\s*\(/;

/** Sentry capture function patterns. */
const CAPTURE_SUPABASE_ERROR = "captureSupabaseError";
const CAPTURE_API_ERROR = "captureApiError";
const IS_FK_VIOLATION = "isForeignKeyViolationError";

/** Bare console.error pattern. */
const CONSOLE_ERROR_PATTERN = /\bconsole\.error\b/;

/** Catch block pattern — matches `catch (identifier)` or `catch (identifier: type)`. */
const CATCH_BLOCK_PATTERN = /\bcatch\s*\(\s*\w+/g;

function collectRouteFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(d: string) {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (entry === "route.ts") {
        files.push(full);
      }
    }
  }

  walk(dir);
  return files;
}

function toRelative(absPath: string): string {
  return relative(PROJECT_ROOT, absPath);
}

describe("API route error-handling consistency", () => {
  const routeFiles = collectRouteFiles(API_DIR);

  it("finds at least one API route file", () => {
    expect(routeFiles.length).toBeGreaterThan(0);
  });

  it("routes with mutations import captureSupabaseError or captureApiError", () => {
    const violations: string[] = [];

    for (const file of routeFiles) {
      const rel = toRelative(file);
      if (ALLOWLIST[rel]) continue;

      const content = readFileSync(file, "utf-8");

      // Skip routes that don't use Supabase at all
      const usesSupabase =
        FROM_CALL_PATTERN.test(content) || RPC_CALL_PATTERN.test(content);
      if (!usesSupabase) continue;

      const hasMutations =
        MUTATION_PATTERN.test(content) || RPC_CALL_PATTERN.test(content);
      if (!hasMutations) continue;

      const hasCaptureSupabase = content.includes(CAPTURE_SUPABASE_ERROR);
      const hasCaptureApi = content.includes(CAPTURE_API_ERROR);

      if (!hasCaptureSupabase && !hasCaptureApi) {
        violations.push(
          `${rel}: performs mutations but does not import ${CAPTURE_SUPABASE_ERROR} or ${CAPTURE_API_ERROR}`,
        );
      }
    }

    expect(
      violations,
      `API routes with Supabase mutations must import error capture utilities:\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("routes with mutations that use .insert/.update/.delete import isForeignKeyViolationError or captureSupabaseError", () => {
    const violations: string[] = [];

    for (const file of routeFiles) {
      const rel = toRelative(file);
      if (ALLOWLIST[rel]) continue;

      const content = readFileSync(file, "utf-8");

      // Only check routes that perform table mutations (not RPC-only routes)
      const hasTableMutations = MUTATION_PATTERN.test(content);
      if (!hasTableMutations) continue;

      // captureSupabaseError already classifies FK violations internally
      // (downgrades to warning level), so either explicit isForeignKeyViolationError
      // checks or captureSupabaseError usage satisfies this requirement.
      const hasFkCheck = content.includes(IS_FK_VIOLATION);
      const hasCaptureSupabase = content.includes(CAPTURE_SUPABASE_ERROR);

      if (!hasFkCheck && !hasCaptureSupabase) {
        violations.push(
          `${rel}: performs table mutations but does not import ${IS_FK_VIOLATION} or ${CAPTURE_SUPABASE_ERROR}`,
        );
      }
    }

    expect(
      violations,
      `API routes with table mutations must handle FK violations (via ${IS_FK_VIOLATION} or ${CAPTURE_SUPABASE_ERROR}):\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("catch blocks use captureApiError or captureSupabaseError, not bare console.error", () => {
    const violations: string[] = [];

    for (const file of routeFiles) {
      const rel = toRelative(file);
      if (ALLOWLIST[rel]) continue;

      const content = readFileSync(file, "utf-8");
      const lines = content.split("\n");

      // Skip routes without catch blocks
      CATCH_BLOCK_PATTERN.lastIndex = 0;
      if (!CATCH_BLOCK_PATTERN.test(content)) continue;

      const hasCaptureSupabase = content.includes(CAPTURE_SUPABASE_ERROR);
      const hasCaptureApi = content.includes(CAPTURE_API_ERROR);

      // If the route has catch blocks but no Sentry capture at all, flag it
      if (!hasCaptureSupabase && !hasCaptureApi) {
        violations.push(
          `${rel}: has catch blocks but does not use ${CAPTURE_API_ERROR} or ${CAPTURE_SUPABASE_ERROR}`,
        );
        continue;
      }

      // Check for bare console.error without accompanying Sentry capture
      for (let i = 0; i < lines.length; i++) {
        if (CONSOLE_ERROR_PATTERN.test(lines[i])) {
          violations.push(
            `${rel}:${i + 1}: uses console.error — use ${CAPTURE_API_ERROR} or ${CAPTURE_SUPABASE_ERROR} instead`,
          );
        }
      }
    }

    expect(
      violations,
      `API route catch blocks must use Sentry capture utilities, not bare console.error:\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("routes with Supabase access have at least one catch block with error capture", () => {
    const violations: string[] = [];

    for (const file of routeFiles) {
      const rel = toRelative(file);
      if (ALLOWLIST[rel]) continue;

      const content = readFileSync(file, "utf-8");

      const usesSupabase =
        FROM_CALL_PATTERN.test(content) || RPC_CALL_PATTERN.test(content);
      if (!usesSupabase) continue;

      // Route uses Supabase — it should have error handling
      CATCH_BLOCK_PATTERN.lastIndex = 0;
      const hasCatchBlock = CATCH_BLOCK_PATTERN.test(content);
      const hasCaptureSupabase = content.includes(CAPTURE_SUPABASE_ERROR);
      const hasCaptureApi = content.includes(CAPTURE_API_ERROR);

      if (!hasCatchBlock || (!hasCaptureSupabase && !hasCaptureApi)) {
        violations.push(
          `${rel}: uses Supabase but lacks a catch block with ${CAPTURE_API_ERROR}/${CAPTURE_SUPABASE_ERROR}`,
        );
      }
    }

    expect(
      violations,
      `API routes using Supabase must have catch blocks with Sentry error capture:\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("allowlist entries reference existing route files", () => {
    const staleEntries: string[] = [];

    for (const rel of Object.keys(ALLOWLIST)) {
      const absPath = join(PROJECT_ROOT, rel);
      try {
        statSync(absPath);
      } catch {
        staleEntries.push(`${rel}: ${ALLOWLIST[rel]}`);
      }
    }

    expect(
      staleEntries,
      `Allowlist contains entries for files that no longer exist — remove them:\n${staleEntries.join("\n")}`,
    ).toEqual([]);
  });
});
