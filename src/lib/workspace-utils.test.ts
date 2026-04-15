import { describe, it, expect } from "vitest";
import { generateSlug, isValidSlug, MAX_CREATED_WORKSPACES } from "./workspace-utils";

describe("generateSlug", () => {
  it("lowercases and hyphenates", () => {
    expect(generateSlug("My Workspace")).toBe("my-workspace");
  });

  it("collapses consecutive hyphens", () => {
    expect(generateSlug("hello   world")).toBe("hello-world");
  });

  it("strips leading and trailing hyphens", () => {
    expect(generateSlug("  --test-- ")).toBe("test");
  });

  it("handles special characters", () => {
    expect(generateSlug("Café & Résumé!")).toBe("caf-r-sum");
  });

  it("returns empty string for non-alphanumeric input", () => {
    expect(generateSlug("---")).toBe("");
  });
});

describe("isValidSlug", () => {
  it("accepts valid slugs", () => {
    expect(isValidSlug("my-workspace")).toBe(true);
    expect(isValidSlug("a1")).toBe(true);
    expect(isValidSlug("test")).toBe(true);
  });

  it("rejects slugs with leading hyphens", () => {
    expect(isValidSlug("-bad")).toBe(false);
  });

  it("rejects slugs with trailing hyphens", () => {
    expect(isValidSlug("bad-")).toBe(false);
  });

  it("rejects slugs with uppercase", () => {
    expect(isValidSlug("Bad")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidSlug("")).toBe(false);
  });

  it("accepts single character", () => {
    expect(isValidSlug("a")).toBe(true);
  });
});

describe("MAX_CREATED_WORKSPACES", () => {
  it("is 3", () => {
    expect(MAX_CREATED_WORKSPACES).toBe(3);
  });
});
