import { describe, it, expect } from "vitest";
import { createLinkMatcherWithRegExp } from "@lexical/react/LexicalAutoLinkPlugin";

// Duplicate the regexes from the plugin so tests verify the actual patterns
const URL_REGEX =
  /((https?:\/\/(www\.)?)|(www\.))[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*[-a-zA-Z0-9()@:%_+~#?&/=])?/;

const EMAIL_REGEX =
  /(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))/;

const urlMatcher = createLinkMatcherWithRegExp(URL_REGEX, (text) =>
  text.startsWith("http") ? text : `https://${text}`,
);

const emailMatcher = createLinkMatcherWithRegExp(
  EMAIL_REGEX,
  (text) => `mailto:${text}`,
);

describe("auto-link URL matcher", () => {
  it("matches https URLs", () => {
    const result = urlMatcher("check https://example.com for details");
    expect(result).not.toBeNull();
    expect(result!.url).toBe("https://example.com");
    expect(result!.text).toBe("https://example.com");
  });

  it("matches http URLs", () => {
    const result = urlMatcher("visit http://example.com today");
    expect(result).not.toBeNull();
    expect(result!.url).toBe("http://example.com");
  });

  it("matches URLs with paths and query strings", () => {
    const result = urlMatcher(
      "see https://example.com/path?q=test&page=1#section",
    );
    expect(result).not.toBeNull();
    expect(result!.url).toBe(
      "https://example.com/path?q=test&page=1#section",
    );
  });

  it("matches www URLs and prepends https://", () => {
    const result = urlMatcher("go to www.example.com now");
    expect(result).not.toBeNull();
    expect(result!.url).toBe("https://www.example.com");
    expect(result!.text).toBe("www.example.com");
  });

  it("does not match plain text without URL pattern", () => {
    const result = urlMatcher("just some regular text");
    expect(result).toBeNull();
  });

  it("does not match bare domain without protocol or www", () => {
    const result = urlMatcher("visit example.com today");
    expect(result).toBeNull();
  });

  it("handles URLs with parentheses", () => {
    const result = urlMatcher(
      "see https://en.wikipedia.org/wiki/Rust_(programming_language) for info",
    );
    expect(result).not.toBeNull();
    expect(result!.url).toContain("Rust_(programming_language)");
  });
});

describe("auto-link email matcher", () => {
  it("matches email addresses", () => {
    const result = emailMatcher("contact user@example.com for help");
    expect(result).not.toBeNull();
    expect(result!.url).toBe("mailto:user@example.com");
    expect(result!.text).toBe("user@example.com");
  });

  it("matches emails with dots in local part", () => {
    const result = emailMatcher("email first.last@company.co.uk please");
    expect(result).not.toBeNull();
    expect(result!.url).toBe("mailto:first.last@company.co.uk");
  });

  it("matches emails with plus addressing", () => {
    const result = emailMatcher("send to user+tag@example.com");
    expect(result).not.toBeNull();
    expect(result!.url).toBe("mailto:user+tag@example.com");
  });

  it("does not match plain text", () => {
    const result = emailMatcher("no email here");
    expect(result).toBeNull();
  });

  it("does not match incomplete email", () => {
    const result = emailMatcher("user@ is not valid");
    expect(result).toBeNull();
  });
});
