import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, join } from "path";

/**
 * Regression tests for issue #101: TypeError in Node.contains() from event handlers.
 *
 * MouseEvent.relatedTarget and Event.target are typed as EventTarget | null,
 * which can be a non-Node object (e.g. when mouse leaves to a cross-origin
 * iframe). Casting these to Node/HTMLElement and passing them to Node.contains()
 * or Element.closest() throws a TypeError.
 *
 * These tests scan source files for unsafe `as Node` or `as HTMLElement` casts
 * on event target properties, ensuring instanceof guards are used instead.
 */

/** Recursively collect .ts/.tsx files under a directory */
function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectSourceFiles(full));
    } else if (/\.tsx?$/.test(entry) && !entry.includes(".test.")) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Matches patterns like:
 *   event.target as Node
 *   event.relatedTarget as HTMLElement
 *   e.target as HTMLElement | null
 *   event.relatedTarget as HTMLElement | null
 *
 * These are unsafe because EventTarget is not necessarily a Node.
 */
const UNSAFE_EVENT_TARGET_CAST =
  /\.\s*(?:target|relatedTarget)\s+as\s+(?:Node|HTMLElement)(?:\s*\|\s*null)?/g;

describe("DOM API type safety — no unsafe event target casts", () => {
  const srcRoot = resolve(__dirname, "../..");
  const sourceFiles = collectSourceFiles(join(srcRoot, "components"));

  it("no files cast event.target or event.relatedTarget as Node/HTMLElement", () => {
    const violations: string[] = [];

    for (const filePath of sourceFiles) {
      const content = readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const matches = lines[i].match(UNSAFE_EVENT_TARGET_CAST);
        if (matches) {
          const relative = filePath.replace(srcRoot + "/", "");
          violations.push(`${relative}:${i + 1}: ${matches[0].trim()}`);
        }
      }
    }

    expect(
      violations,
      "Use `instanceof Node` or `instanceof HTMLElement` guards instead of `as` casts on event targets. " +
        "See issue #101.\n\nViolations:\n" +
        violations.join("\n")
    ).toHaveLength(0);
  });
});
