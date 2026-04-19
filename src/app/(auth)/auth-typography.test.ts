import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Regression test for issue #38: auth page headings must use font-semibold
 * per the design spec. font-bold at text-2xl is incorrect — font-bold is
 * reserved for the page title in the editor at text-3xl.
 */
describe("auth page typography", () => {
  const authDir = join(__dirname);

  it("sign-in heading uses font-semibold, not font-bold", () => {
    const source = readFileSync(join(authDir, "sign-in/sign-in-form.tsx"), "utf-8");
    const cardTitleMatch = source.match(/CardTitle[^>]*className="([^"]*)"/);
    expect(cardTitleMatch).not.toBeNull();
    const classes = cardTitleMatch![1];
    expect(classes).toContain("font-semibold");
    expect(classes).not.toContain("font-bold");
  });

  it("sign-up heading uses font-semibold, not font-bold", () => {
    const source = readFileSync(join(authDir, "sign-up/sign-up-form.tsx"), "utf-8");
    const cardTitleMatch = source.match(/CardTitle[^>]*className="([^"]*)"/);
    expect(cardTitleMatch).not.toBeNull();
    const classes = cardTitleMatch![1];
    expect(classes).toContain("font-semibold");
    expect(classes).not.toContain("font-bold");
  });
});
