import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const DIR = resolve(__dirname);

describe("members route loading state", () => {
  it("loading.tsx exists for the members route segment", () => {
    expect(existsSync(resolve(DIR, "loading.tsx"))).toBe(true);
  });

  it("loading skeleton uses the same layout container as members page", () => {
    const loading = readFileSync(resolve(DIR, "loading.tsx"), "utf-8");
    expect(loading).toContain("mx-auto max-w-xl p-6");
  });

  it("loading skeleton includes animate-pulse elements", () => {
    const loading = readFileSync(resolve(DIR, "loading.tsx"), "utf-8");
    expect(loading).toContain("animate-pulse");
  });

  it("skeleton elements use bg-muted per design spec", () => {
    const loading = readFileSync(resolve(DIR, "loading.tsx"), "utf-8");
    expect(loading).toContain("bg-muted");
  });

  it("skeleton elements use sharp corners per design spec", () => {
    const loading = readFileSync(resolve(DIR, "loading.tsx"), "utf-8");
    const lines = loading.split("\n");
    const skeletonLines = lines.filter((l) => l.includes("animate-pulse"));
    expect(skeletonLines.length).toBeGreaterThan(0);
    for (const line of skeletonLines) {
      expect(line).not.toMatch(/\brounded\b/);
    }
  });
});
