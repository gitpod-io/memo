import { describe, it, expect } from "vitest";
import { generateSlug, isValidSlug, WORKSPACE_LIMIT } from "./workspace";

describe("generateSlug", () => {
  it("lowercases and hyphenates a name", () => {
    const slug = generateSlug("My Team");
    expect(slug).toMatch(/^my-team-[a-z0-9]{6}$/);
  });

  it("collapses consecutive special characters into a single hyphen", () => {
    const slug = generateSlug("Hello   World!!!");
    expect(slug).toMatch(/^hello-world-[a-z0-9]{6}$/);
  });

  it("handles empty string", () => {
    const slug = generateSlug("");
    expect(slug).toMatch(/^[a-z0-9]{6}$/);
  });

  it("trims leading and trailing hyphens from the base", () => {
    const slug = generateSlug("--test--");
    expect(slug).toMatch(/^test-[a-z0-9]{6}$/);
  });

  it("generates unique slugs for the same input", () => {
    const a = generateSlug("Team");
    const b = generateSlug("Team");
    expect(a).not.toBe(b);
  });
});

describe("isValidSlug", () => {
  it("accepts a valid slug", () => {
    expect(isValidSlug("my-team-abc123")).toBe(true);
  });

  it("rejects slugs with uppercase", () => {
    expect(isValidSlug("My-Team")).toBe(false);
  });

  it("rejects slugs starting with a hyphen", () => {
    expect(isValidSlug("-my-team")).toBe(false);
  });

  it("rejects slugs ending with a hyphen", () => {
    expect(isValidSlug("my-team-")).toBe(false);
  });

  it("rejects slugs shorter than 3 characters", () => {
    expect(isValidSlug("ab")).toBe(false);
  });

  it("accepts 3-character slugs", () => {
    expect(isValidSlug("abc")).toBe(true);
  });
});

describe("WORKSPACE_LIMIT", () => {
  it("is 3", () => {
    expect(WORKSPACE_LIMIT).toBe(3);
  });
});
