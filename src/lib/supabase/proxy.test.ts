import { describe, it, expect, vi, beforeEach } from "vitest";

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

// Mock @supabase/ssr to capture the cookie options passed to createServerClient
vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    opts?: { cookies?: CookieOptions },
  ) => {
    capturedCookies = opts?.cookies ?? null;
    return {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    };
  },
}));

// Mock next/server with minimal NextRequest/NextResponse implementations
const mockCookiesGetAll = vi.fn<() => CookieEntry[]>().mockReturnValue([]);
const mockCookiesSet = vi.fn();

vi.mock("next/server", () => {
  class MockNextRequest {
    cookies = {
      getAll: mockCookiesGetAll,
      set: mockCookiesSet,
    };
    nextUrl: { pathname: string; clone: () => { pathname: string } };

    constructor(url: string) {
      const pathname = new URL(url).pathname;
      this.nextUrl = {
        pathname,
        clone: () => ({ pathname }),
      };
    }
  }

  return {
    NextRequest: MockNextRequest,
    NextResponse: {
      next: vi.fn().mockReturnValue({
        cookies: { set: vi.fn() },
      }),
      redirect: vi.fn().mockReturnValue({
        cookies: { set: vi.fn() },
      }),
    },
  };
});

import { NextRequest } from "next/server";
import { updateSession } from "./proxy";

describe("proxy cookie null-safety", () => {
  beforeEach(() => {
    capturedCookies = null;
    mockCookiesGetAll.mockReset();
    mockCookiesSet.mockReset();
  });

  it("getAll coerces null cookie values to empty strings", async () => {
    // Simulate cookies with null values during session teardown
    mockCookiesGetAll.mockReturnValue([
      { name: "sb-auth-token", value: "valid-token" },
      { name: "sb-auth-token.0", value: null as unknown as string },
      { name: "sb-auth-token.1", value: undefined as unknown as string },
    ]);

    const request = new NextRequest("http://localhost/sign-in");
    await updateSession(request as never);

    expect(capturedCookies).not.toBeNull();
    const cookies = capturedCookies!.getAll();

    // Every value must be a string — never null/undefined
    for (const cookie of cookies) {
      expect(typeof cookie.value).toBe("string");
      // This is the exact operation that crashes in @supabase/ssr's
      // combineChunks without the null guard
      expect(() => cookie.value.startsWith("base64-")).not.toThrow();
    }

    expect(cookies).toEqual([
      { name: "sb-auth-token", value: "valid-token" },
      { name: "sb-auth-token.0", value: "" },
      { name: "sb-auth-token.1", value: "" },
    ]);
  });

  it("getAll preserves valid cookie values unchanged", async () => {
    mockCookiesGetAll.mockReturnValue([
      { name: "session", value: "abc123" },
      { name: "theme", value: "dark" },
    ]);

    const request = new NextRequest("http://localhost/sign-in");
    await updateSession(request as never);

    const cookies = capturedCookies!.getAll();
    expect(cookies).toEqual([
      { name: "session", value: "abc123" },
      { name: "theme", value: "dark" },
    ]);
  });
});
