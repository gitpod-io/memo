import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Regression test for filter/sort toolbar design spec compliance.
 *
 * The design spec (.agents/design.md → Filter & Sort Bar) requires:
 * - Background: transparent (no bg-muted), p-2, sharp corners.
 */

function readSource(): string {
  return readFileSync(
    resolve(__dirname, "./database-view-client.tsx"),
    "utf-8",
  );
}

describe("filter/sort toolbar design spec compliance", () => {
  const source = readSource();

  it("toolbar container does not have bg-muted background", () => {
    // Design spec: toolbar uses transparent background (same as page).
    const toolbarMatch = source.match(
      /Sort & filter toolbar[\s\S]*?<div className="([^"]*)"/,
    );
    expect(toolbarMatch).not.toBeNull();
    expect(toolbarMatch![1]).not.toContain("bg-muted");
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
