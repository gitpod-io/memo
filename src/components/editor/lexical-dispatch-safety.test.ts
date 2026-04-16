import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, join } from "path";

/**
 * Regression test for Sentry MEMO-5: "Cannot use method in read-only mode."
 *
 * Lexical's dispatchCommand() triggers command listeners synchronously. If a
 * listener mutates the editor state (e.g. $toggleLink calling splitText) and
 * dispatchCommand was called outside editor.update(), the mutation can execute
 * in a read-only context — especially when an editorState.read() is active on
 * the call stack.
 *
 * This test scans editor source files for bare editor.dispatchCommand() calls
 * that are NOT wrapped in editor.update(). Commands that mutate state (like
 * TOGGLE_LINK_COMMAND) must be dispatched inside editor.update().
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
 * Commands known to mutate editor state when handled by their default
 * @lexical/react plugin listeners.
 */
const MUTATING_COMMANDS = [
  "TOGGLE_LINK_COMMAND",
  "INSERT_PARAGRAPH_COMMAND",
  "INSERT_LINE_BREAK_COMMAND",
  "DELETE_CHARACTER_COMMAND",
  "DELETE_WORD_COMMAND",
  "DELETE_LINE_COMMAND",
  "FORMAT_TEXT_COMMAND",
  "FORMAT_ELEMENT_COMMAND",
  "INSERT_TAB_COMMAND",
  "INDENT_CONTENT_COMMAND",
  "OUTDENT_CONTENT_COMMAND",
  "REMOVE_TEXT_COMMAND",
  "PASTE_COMMAND",
  "CUT_COMMAND",
];

describe("Lexical dispatchCommand safety — mutating commands inside editor.update()", () => {
  const editorDir = resolve(__dirname);
  const sourceFiles = collectSourceFiles(editorDir);

  it("mutating commands are not dispatched outside editor.update()", () => {
    const violations: string[] = [];
    const commandPattern = new RegExp(
      `editor\\.dispatchCommand\\(\\s*(${MUTATING_COMMANDS.join("|")})`,
      "g"
    );

    for (const filePath of sourceFiles) {
      const content = readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(commandPattern);
        if (!match) continue;

        // Check if editor.update( appears on the same line before dispatchCommand
        const colIdx = lines[i].indexOf("editor.dispatchCommand");
        const linePrefix = lines[i].substring(0, colIdx);
        if (/editor\.update\s*\(/.test(linePrefix)) continue;

        // Walk backwards through preceding lines to find an enclosing
        // editor.update() block. Track brace/paren depth to stay within
        // the same scope.
        let insideUpdate = false;
        let braceDepth = 0;

        for (let j = i - 1; j >= 0 && j >= i - 30; j--) {
          const line = lines[j];

          for (let c = line.length - 1; c >= 0; c--) {
            if (line[c] === "}" || line[c] === ")") braceDepth++;
            if (line[c] === "{" || line[c] === "(") braceDepth--;
          }

          if (braceDepth < 0 && /editor\.update\s*\(/.test(line)) {
            insideUpdate = true;
            break;
          }
          // If we've exited the enclosing scope, stop
          if (braceDepth > 2) break;
        }

        if (!insideUpdate) {
          const relative = filePath.replace(
            resolve(__dirname, "../..") + "/",
            ""
          );
          violations.push(
            `${relative}:${i + 1}: ${match[0]} — must be inside editor.update()`
          );
        }
      }
    }

    expect(
      violations,
      "Mutating Lexical commands must be dispatched inside editor.update() to " +
        "avoid read-only mode errors. See Sentry MEMO-5.\n\nViolations:\n" +
        violations.join("\n")
    ).toHaveLength(0);
  });
});
