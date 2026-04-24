import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const DIR = resolve(__dirname);

describe("settings route error boundary", () => {
  it("error.tsx exists for the settings route segment", () => {
    expect(existsSync(resolve(DIR, "error.tsx"))).toBe(true);
  });

  it("is a client component (required by Next.js error boundaries)", () => {
    const source = readFileSync(resolve(DIR, "error.tsx"), "utf-8");
    expect(source).toMatch(/^"use client"/);
  });

  it("uses the shared RouteError component", () => {
    const source = readFileSync(resolve(DIR, "error.tsx"), "utf-8");
    expect(source).toContain("RouteError");
  });

  it("passes error and reset props through", () => {
    const source = readFileSync(resolve(DIR, "error.tsx"), "utf-8");
    expect(source).toContain("error={error}");
    expect(source).toContain("reset={reset}");
  });
});
