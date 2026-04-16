import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { formatRelativeDate } from "./relative-time";

describe("formatRelativeDate", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for dates less than 1 minute ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:30Z"));
    expect(formatRelativeDate("2024-06-15T12:00:00Z")).toBe("just now");
  });

  it("returns minutes ago for dates less than 1 hour ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:47:00Z"));
    expect(formatRelativeDate("2024-06-15T12:00:00Z")).toBe("47m ago");
  });

  it("returns hours ago for dates less than 24 hours ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T15:00:00Z"));
    expect(formatRelativeDate("2024-06-15T12:00:00Z")).toBe("3h ago");
  });

  it("returns days ago for dates less than 7 days ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-18T12:00:00Z"));
    expect(formatRelativeDate("2024-06-15T12:00:00Z")).toBe("3d ago");
  });

  it("returns formatted date for dates 7+ days ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-25T12:00:00Z"));
    expect(formatRelativeDate("2024-06-15T12:00:00Z")).toBe("Jun 15");
  });
});

describe("RelativeTime hydration safety", () => {
  it("uses suppressHydrationWarning to prevent hydration mismatch errors", () => {
    const source = readFileSync(
      join(__dirname, "relative-time.tsx"),
      "utf-8",
    );

    // The component must use suppressHydrationWarning on the span element
    // so React ignores the text content difference between SSR and client.
    expect(source).toContain("suppressHydrationWarning");
  });

  it("uses useEffect with setInterval to keep the display current", () => {
    const source = readFileSync(
      join(__dirname, "relative-time.tsx"),
      "utf-8",
    );

    expect(source).toMatch(/useEffect\(/);
    expect(source).toMatch(/setInterval\(/);
  });
});
