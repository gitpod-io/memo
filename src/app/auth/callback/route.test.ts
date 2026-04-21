import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockExchangeCodeForSession = vi.fn();
const mockSignOut = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockLimit = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      exchangeCodeForSession: (...args: unknown[]) =>
        mockExchangeCodeForSession(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
    from: () => ({
      select: (...args: unknown[]) => {
        mockSelect(...args);
        return {
          eq: (...eqArgs: unknown[]) => {
            mockEq(...eqArgs);
            return {
              limit: (...limitArgs: unknown[]) => {
                mockLimit(...limitArgs);
                return { maybeSingle: () => mockMaybeSingle() };
              },
            };
          },
        };
      },
    }),
  }),
}));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /auth/callback", () => {
  describe("email confirmation", () => {
    it("exchanges code, signs out, and redirects to sign-in with confirmed=true", async () => {
      mockExchangeCodeForSession.mockResolvedValue({
        data: {
          user: { id: "u1", app_metadata: { provider: "email" } },
          session: {},
        },
        error: null,
      });
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
  });

  describe("OAuth sign-in", () => {
    it("exchanges code and redirects to user workspace", async () => {
      mockExchangeCodeForSession.mockResolvedValue({
        data: {
          user: { id: "u1", app_metadata: { provider: "github" } },
          session: {},
        },
        error: null,
      });
      mockMaybeSingle.mockResolvedValue({
        data: { workspaces: { slug: "my-workspace" } },
      });

      const request = new NextRequest(
        "http://localhost:3000/auth/callback?code=oauth-code",
      );
      const response = await GET(request);

      expect(mockExchangeCodeForSession).toHaveBeenCalledWith("oauth-code");
      expect(mockSignOut).not.toHaveBeenCalled();
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/my-workspace",
      );
    });

    it("redirects to root when no workspace membership found", async () => {
      mockExchangeCodeForSession.mockResolvedValue({
        data: {
          user: { id: "u1", app_metadata: { provider: "google" } },
          session: {},
        },
        error: null,
      });
      mockMaybeSingle.mockResolvedValue({ data: null });

      const request = new NextRequest(
        "http://localhost:3000/auth/callback?code=oauth-code",
      );
      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost:3000/");
    });
  });

  describe("error handling", () => {
    it("redirects with error when OAuth provider returns error_description", async () => {
      const request = new NextRequest(
        "http://localhost:3000/auth/callback?error_description=access_denied",
      );
      const response = await GET(request);

      expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
      expect(response.status).toBe(307);
      const location = response.headers.get("location")!;
      expect(location).toContain("/sign-in?error=access_denied");
    });

    it("redirects with error when OAuth provider returns error param", async () => {
      const request = new NextRequest(
        "http://localhost:3000/auth/callback?error=server_error",
      );
      const response = await GET(request);

      expect(response.status).toBe(307);
      const location = response.headers.get("location")!;
      expect(location).toContain("/sign-in?error=server_error");
    });

    it("redirects with error when code exchange fails", async () => {
      mockExchangeCodeForSession.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: "Invalid code" },
      });

      const request = new NextRequest(
        "http://localhost:3000/auth/callback?code=bad-code",
      );
      const response = await GET(request);

      expect(mockExchangeCodeForSession).toHaveBeenCalledWith("bad-code");
      expect(mockSignOut).not.toHaveBeenCalled();
      expect(response.status).toBe(307);
      const location = response.headers.get("location")!;
      expect(location).toContain("/sign-in?error=Invalid+code");
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
});
