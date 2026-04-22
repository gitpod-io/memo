import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Regression test for issue #569: database view should use full page width.
 *
 * Database pages must not be constrained by max-w-3xl. The page layout
 * conditionally applies the max-width based on the isDatabase flag.
 */

const PAGE_DIR = resolve(__dirname);

describe("database page width (#569)", () => {
  it("page layout conditionally applies max-w-3xl based on isDatabase", () => {
    const page = readFileSync(resolve(PAGE_DIR, "page.tsx"), "utf-8");
    // The outer container must use a conditional class that omits max-w-3xl for databases
    expect(page).toContain("isDatabase");
    expect(page).toMatch(/isDatabase\s*\?\s*""\s*:\s*"max-w-3xl"/);
  });

  it("non-database pages still get max-w-3xl constraint", () => {
    const page = readFileSync(resolve(PAGE_DIR, "page.tsx"), "utf-8");
    // The conditional must include max-w-3xl for the non-database branch
    expect(page).toContain('max-w-3xl');
  });

  it("database pages get full width (no max-w-3xl)", () => {
    const page = readFileSync(resolve(PAGE_DIR, "page.tsx"), "utf-8");
    // The outer div must NOT have a hardcoded max-w-3xl — it must be conditional
    expect(page).not.toMatch(/className="mx-auto max-w-3xl p-6"/);
  });
});
