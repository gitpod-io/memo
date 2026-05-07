import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type CookieEntry = { name: string; value: string };
type SetCookieEntry = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};
type CookieOptions = {
  getAll: () => CookieEntry[];
  setAll: (cookies: SetCookieEntry[]) => void;
};

let capturedCookies: CookieOptions | null = null;

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: (
    _url: string,
    _key: string,
    opts?: { cookies?: CookieOptions },
  ) => {
    capturedCookies = opts?.cookies ?? null;
    return {} as unknown;
  },
}));

// Must import after mock setup
import { createClient } from "./client";

describe("createClient cookie handling", () => {
  let originalCookie: PropertyDescriptor | undefined;

  beforeEach(() => {
    capturedCookies = null;
    originalCookie = Object.getOwnPropertyDescriptor(document, "cookie");
  });

  afterEach(() => {
    if (originalCookie) {
      Object.defineProperty(document, "cookie", originalCookie);
    } else {
      // Reset to default jsdom behavior
      Object.defineProperty(document, "cookie", {
        get() {
          return "";
        },
        set() {},
        configurable: true,
      });
    }
  });

  it("provides custom cookie options to createBrowserClient", () => {
    createClient();
    expect(capturedCookies).not.toBeNull();
    expect(capturedCookies!.getAll).toBeInstanceOf(Function);
    expect(capturedCookies!.setAll).toBeInstanceOf(Function);
  });

  it("getAll parses document.cookie into name/value pairs", () => {
    Object.defineProperty(document, "cookie", {
      get: () => "session=abc123; theme=dark",
      set: vi.fn(),
      configurable: true,
    });

    createClient();
    const cookies = capturedCookies!.getAll();

    expect(cookies).toEqual([
      { name: "session", value: "abc123" },
      { name: "theme", value: "dark" },
    ]);
  });

  it("getAll returns empty array when document.cookie is empty", () => {
    Object.defineProperty(document, "cookie", {
      get: () => "",
      set: vi.fn(),
      configurable: true,
    });

    createClient();
    const cookies = capturedCookies!.getAll();

    expect(cookies).toEqual([]);
  });

  it("getAll returns string values that are safe for startsWith (null-safety regression)", () => {
    // Simulate a cookie string where parsing could yield edge-case values.
    // The ?? "" guard ensures every value is a string, preventing the
    // TypeError: Cannot read properties of null (reading 'startsWith')
    // that occurs in @supabase/ssr's combineChunks.
    Object.defineProperty(document, "cookie", {
      get: () => "sb-auth-token.0=chunk0; sb-auth-token.1=; sb-auth-token.2=chunk2",
      set: vi.fn(),
      configurable: true,
    });

    createClient();
    const cookies = capturedCookies!.getAll();

    // Every value must be a string (never null/undefined)
    for (const cookie of cookies) {
      expect(typeof cookie.value).toBe("string");
      // This is the exact operation that crashes without the null guard
      expect(() => cookie.value.startsWith("base64-")).not.toThrow();
    }

    expect(cookies).toEqual([
      { name: "sb-auth-token.0", value: "chunk0" },
      { name: "sb-auth-token.1", value: "" },
      { name: "sb-auth-token.2", value: "chunk2" },
    ]);
  });

  it("getAll handles cookies with = in the value", () => {
    Object.defineProperty(document, "cookie", {
      get: () => "token=abc=def=ghi",
      set: vi.fn(),
      configurable: true,
    });

    createClient();
    const cookies = capturedCookies!.getAll();

    expect(cookies).toEqual([{ name: "token", value: "abc=def=ghi" }]);
  });

  it("setAll writes cookies to document.cookie", () => {
    const setCalls: string[] = [];
    Object.defineProperty(document, "cookie", {
      get: () => "",
      set: (val: string) => setCalls.push(val),
      configurable: true,
    });

    createClient();
    capturedCookies!.setAll([
      { name: "session", value: "xyz", options: { path: "/", secure: true } },
    ]);

    expect(setCalls).toHaveLength(1);
    expect(setCalls[0]).toContain("session=xyz");
    expect(setCalls[0]).toContain("path=/");
    expect(setCalls[0]).toContain("secure");
  });

  it("setAll omits false and null option values", () => {
    const setCalls: string[] = [];
    Object.defineProperty(document, "cookie", {
      get: () => "",
      set: (val: string) => setCalls.push(val),
      configurable: true,
    });

    createClient();
    capturedCookies!.setAll([
      {
        name: "test",
        value: "val",
        options: { path: "/", httpOnly: false, sameSite: null },
      },
    ]);

    expect(setCalls).toHaveLength(1);
    expect(setCalls[0]).toContain("test=val");
    expect(setCalls[0]).toContain("path=/");
    expect(setCalls[0]).not.toContain("httpOnly");
    expect(setCalls[0]).not.toContain("sameSite");
  });
});
