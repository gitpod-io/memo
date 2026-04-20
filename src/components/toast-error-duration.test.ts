import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

/**
 * Regression test for issue #87: toast.error() calls must specify
 * { duration: 8000 } per the design spec (8 seconds for errors).
 *
 * Scans all .tsx/.ts source files under src/ for toast.error() calls
 * and verifies each one includes the duration option.
 */

function collectFiles(dir: string, ext: string[]): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      results.push(...collectFiles(full, ext));
    } else if (ext.some((e) => full.endsWith(e))) {
      results.push(full);
    }
  }
  return results;
}

describe("toast.error() duration matches design spec", () => {
  const srcDir = join(__dirname, "..");
  const files = collectFiles(srcDir, [".ts", ".tsx"]).filter(
    (f) =>
      !f.endsWith(".test.ts") &&
      !f.endsWith(".test.tsx") &&
      !f.endsWith("lib/toast.ts") // lazy wrapper — forwards caller's data as-is
  );

  it("every toast.error() call includes { duration: 8000 }", () => {
    const violations: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        if (!lines[i].includes("toast.error(")) continue;

        // Collect the full statement (may span multiple lines)
        let statement = lines[i];
        let j = i;
        while (j < lines.length - 1 && !statement.includes(");")) {
          j++;
          statement += " " + lines[j];
        }

        if (!statement.includes("duration: 8000")) {
          const rel = relative(srcDir, file);
          violations.push(`${rel}:${i + 1}: ${lines[i].trim()}`);
        }
      }
    }

    expect(
      violations,
      `toast.error() calls missing { duration: 8000 } (design spec: 8s for errors):\n${violations.join("\n")}`
    ).toHaveLength(0);
  });
});
