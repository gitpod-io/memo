import { describe, it, expect } from "vitest";
import { buildCsp, getSecurityHeaders } from "./security-headers";

describe("getSecurityHeaders", () => {
  const headers = getSecurityHeaders("https://abc.supabase.co");
  const headerMap = new Map(headers.map((h) => [h.key, h.value]));

  it("includes X-Content-Type-Options: nosniff", () => {
    expect(headerMap.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("includes X-Frame-Options: DENY", () => {
    expect(headerMap.get("X-Frame-Options")).toBe("DENY");
  });

  it("includes Referrer-Policy: strict-origin-when-cross-origin", () => {
    expect(headerMap.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
  });

  it("includes Permissions-Policy disabling unused browser features", () => {
    const value = headerMap.get("Permissions-Policy")!;
    expect(value).toContain("camera=()");
    expect(value).toContain("microphone=()");
    expect(value).toContain("geolocation=()");
    expect(value).toContain("browsing-topics=()");
    expect(value).toContain("payment=()");
    expect(value).toContain("usb=()");
  });

  it("includes Strict-Transport-Security with 2-year max-age and preload", () => {
    expect(headerMap.get("Strict-Transport-Security")).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );
  });

  it("includes Content-Security-Policy header", () => {
    expect(headerMap.has("Content-Security-Policy")).toBe(true);
  });

  it("returns all six security headers", () => {
    expect(headers).toHaveLength(6);
  });
});

describe("buildCsp", () => {
  it("includes self as default-src", () => {
    const csp = buildCsp();
    expect(csp).toContain("default-src 'self'");
  });

  it("allows self and unsafe-inline for script-src without unsafe-eval", () => {
    const csp = buildCsp();
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("allows unsafe-inline for style-src (required by Tailwind/Lexical)", () => {
    const csp = buildCsp();
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });

  it("includes Supabase URL in connect-src when provided", () => {
    const csp = buildCsp("https://abc.supabase.co");
    expect(csp).toContain("connect-src 'self' https://abc.supabase.co");
  });

  it("includes Supabase URL in img-src when provided", () => {
    const csp = buildCsp("https://abc.supabase.co");
    expect(csp).toContain("img-src 'self' https://abc.supabase.co blob: data:");
  });

  it("omits Supabase URL when not provided", () => {
    const csp = buildCsp();
    expect(csp).toContain("connect-src 'self'");
    expect(csp).not.toContain("supabase");
  });

  it("blocks framing via frame-src and frame-ancestors", () => {
    const csp = buildCsp();
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("blocks object embeds", () => {
    const csp = buildCsp();
    expect(csp).toContain("object-src 'none'");
  });

  it("restricts base-uri and form-action to self", () => {
    const csp = buildCsp();
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it("allows blob: for worker-src", () => {
    const csp = buildCsp();
    expect(csp).toContain("worker-src 'self' blob:");
  });

  it("allows self for font-src", () => {
    const csp = buildCsp();
    expect(csp).toContain("font-src 'self'");
  });
});
