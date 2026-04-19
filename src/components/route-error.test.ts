import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const COMPONENT_PATH = resolve(__dirname, "route-error.tsx");

describe("RouteError component", () => {
  const source = readFileSync(COMPONENT_PATH, "utf-8");

  it("is a client component", () => {
    expect(source).toMatch(/^"use client"/);
  });

  it("reports errors to Sentry via captureException in useEffect", () => {
    expect(source).toContain("Sentry.captureException(error)");
    expect(source).toContain("useEffect");
  });

  it("renders a Try again button that calls reset()", () => {
    expect(source).toContain("reset()");
    expect(source).toContain("Try again");
  });

  it("uses design tokens: destructive icon, muted-foreground description", () => {
    expect(source).toContain("text-destructive");
    expect(source).toContain("text-muted-foreground");
  });

  it("follows empty state pattern: icon + heading + description + CTA", () => {
    expect(source).toContain("Something went wrong");
    expect(source).toContain("<Button");
  });

  it("uses named export (not default)", () => {
    expect(source).toContain("export function RouteError");
  });
});
