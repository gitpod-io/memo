import { describe, expect, it } from "vitest";
import {
  getWordCount,
  getReadingTime,
  formatWordCountDisplay,
} from "./word-count";

describe("getWordCount", () => {
  it("returns 0 for empty string", () => {
    expect(getWordCount("")).toBe(0);
  });

  it("returns 0 for whitespace-only string", () => {
    expect(getWordCount("   \n\t  ")).toBe(0);
  });

  it("counts single word", () => {
    expect(getWordCount("hello")).toBe(1);
  });

  it("counts multiple words", () => {
    expect(getWordCount("hello world foo bar")).toBe(4);
  });

  it("handles multiple spaces between words", () => {
    expect(getWordCount("hello   world")).toBe(2);
  });

  it("handles newlines and tabs", () => {
    expect(getWordCount("hello\nworld\tfoo")).toBe(3);
  });

  it("handles leading and trailing whitespace", () => {
    expect(getWordCount("  hello world  ")).toBe(2);
  });

  it("returns 0 for null-ish input", () => {
    expect(getWordCount("")).toBe(0);
  });
});

describe("getReadingTime", () => {
  it("returns 0 for 0 words", () => {
    expect(getReadingTime(0)).toBe(0);
  });

  it("returns 1 minute for 1 word", () => {
    expect(getReadingTime(1)).toBe(1);
  });

  it("returns 1 minute for 200 words", () => {
    expect(getReadingTime(200)).toBe(1);
  });

  it("returns 2 minutes for 201 words", () => {
    expect(getReadingTime(201)).toBe(2);
  });

  it("returns 5 minutes for 1000 words", () => {
    expect(getReadingTime(1000)).toBe(5);
  });

  it("rounds up to next minute", () => {
    expect(getReadingTime(401)).toBe(3);
  });
});

describe("formatWordCountDisplay", () => {
  it("shows '0 words' for empty content", () => {
    expect(formatWordCountDisplay(0)).toBe("0 words");
  });

  it("shows singular 'word' for 1 word", () => {
    expect(formatWordCountDisplay(1)).toBe("1 word · 1 min read");
  });

  it("shows plural 'words' for multiple words", () => {
    expect(formatWordCountDisplay(50)).toBe("50 words · 1 min read");
  });

  it("shows correct reading time for longer content", () => {
    expect(formatWordCountDisplay(500)).toBe("500 words · 3 min read");
  });
});
