import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Regression test for issue #524: filter/sort toolbar design spec compliance.
 *
 * The design spec (.agents/design.md → Filter & Sort Bar) requires:
 * - Background: bg-muted p-2, sharp corners.
 */

function readSource(): string {
  return readFileSync(
    resolve(__dirname, "./database-view-client.tsx"),
    "utf-8",
  );
}

describe("filter/sort toolbar design spec compliance", () => {
  const source = readSource();

  it("toolbar container has bg-muted background", () => {
    // Design spec: "Background: bg-muted p-2, sharp corners."
    // The sort/filter toolbar div must include bg-muted.
    const toolbarMatch = source.match(
      /Sort & filter toolbar[\s\S]*?<div className="([^"]*)"/,
    );
    expect(toolbarMatch).not.toBeNull();
    expect(toolbarMatch![1]).toContain("bg-muted");
  });

  it("toolbar container has p-2 padding", () => {
    // Design spec: "Background: bg-muted p-2, sharp corners."
    const toolbarMatch = source.match(
      /Sort & filter toolbar[\s\S]*?<div className="([^"]*)"/,
    );
    expect(toolbarMatch).not.toBeNull();
    expect(toolbarMatch![1]).toContain("p-2");
  });
});
