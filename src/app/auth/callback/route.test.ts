import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockExchangeCodeForSession = vi.fn();
const mockSignOut = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      exchangeCodeForSession: (...args: unknown[]) =>
        mockExchangeCodeForSession(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  }),
}));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /auth/callback", () => {
  it("exchanges code for session and redirects to sign-in with confirmed=true", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue({ error: null });

    const request = new NextRequest(
      "http://localhost:3000/auth/callback?code=test-auth-code",
    );
    const response = await GET(request);

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("test-auth-code");
    expect(mockSignOut).toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/sign-in?confirmed=true",
    );
  });

  it("redirects to sign-in without confirmed param when code exchange fails", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      error: { message: "Invalid code" },
    });

    const request = new NextRequest(
      "http://localhost:3000/auth/callback?code=bad-code",
    );
    const response = await GET(request);

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("bad-code");
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/sign-in",
    );
  });

  it("redirects to sign-in when no code param is provided", async () => {
    const request = new NextRequest("http://localhost:3000/auth/callback");
    const response = await GET(request);

    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/sign-in",
    );
  });
});
