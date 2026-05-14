import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock next/headers cookies before importing the route
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}));

// Mock the Supabase server client
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Mock rate limiter as passthrough so existing tests aren't affected
vi.mock("@/lib/rate-limit", () => ({
  withRateLimit: (handler: (...args: unknown[]) => unknown) => handler,
  getClientIp: () => "127.0.0.1",
}));

const captureApiErrorMock = vi.fn();

vi.mock("@/lib/sentry", () => ({
  captureApiError: (...args: unknown[]) => captureApiErrorMock(...args),
  captureSupabaseError: vi.fn(),
  isInsufficientPrivilegeError: (err: Error & { code?: string }) =>
    err.code === "42501" ||
    err.message?.includes("violates row-level security policy"),
  isTransientNetworkError: (err: Error) =>
    err.message === "fetch failed" ||
    err.message === "TypeError: fetch failed" ||
    err.message?.startsWith("TypeError: Failed to fetch"),
}));

// Mock retry to run synchronously in tests (no actual delays)
vi.mock("@/lib/retry", async () => {
  const actual = await vi.importActual<typeof import("@/lib/retry")>(
    "@/lib/retry",
  );
  return {
    retryOnNetworkError: actual.retryOnNetworkError,
  };
});

import { DELETE } from "./route";
import { createClient } from "@/lib/supabase/server";

const mockedCreateClient = vi.mocked(createClient);

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/account", {
    method: "DELETE",
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";
});

describe("DELETE /api/account", () => {
  it("returns 503 when Supabase is not configured", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const response = await DELETE(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("Supabase not configured");
  });

  it("returns 401 when user is not authenticated", async () => {
    const mockGetUser = vi.fn().mockResolvedValue({ data: { user: null } });
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: mockGetUser },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const response = await DELETE(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 409 when user is sole owner of a workspace (P0002)", async () => {
    const mockGetUser = vi
      .fn()
      .mockResolvedValue({ data: { user: { id: "user-1" } } });
    const mockRpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message:
          "You are the sole owner of: Team Workspace. Transfer ownership before deleting your account.",
        code: "P0002",
        details: "",
        hint: "",
      },
    });
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: mockGetUser },
      rpc: mockRpc,
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const response = await DELETE(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("sole owner");
    expect(mockRpc).toHaveBeenCalledWith("delete_account");
  });

  it("returns 500 when RPC fails with unexpected error", async () => {
    const mockGetUser = vi
      .fn()
      .mockResolvedValue({ data: { user: { id: "user-1" } } });
    const mockRpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message: "Internal error",
        code: "PGRST",
        details: "",
        hint: "",
      },
    });
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: mockGetUser },
      rpc: mockRpc,
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const response = await DELETE(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Account deletion failed");
  });

  it("returns 200 on successful deletion", async () => {
    const mockGetUser = vi
      .fn()
      .mockResolvedValue({ data: { user: { id: "user-1" } } });
    const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: mockGetUser },
      rpc: mockRpc,
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const response = await DELETE(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith("delete_account");
  });

  it("routes transient fetch errors through captureApiError (#856)", async () => {
    const fetchError = new TypeError("fetch failed");
    mockedCreateClient.mockRejectedValue(fetchError);

    const response = await DELETE(makeRequest());

    expect(response.status).toBe(500);
    expect(captureApiErrorMock).toHaveBeenCalledWith(
      fetchError,
      "account:delete",
    );
  });

  it("retries auth.getUser on transient network error (#1087)", async () => {
    const mockGetUser = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });

    mockedCreateClient.mockResolvedValue({
      auth: { getUser: mockGetUser },
      rpc: mockRpc,
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const response = await DELETE(makeRequest());

    expect(response.status).toBe(200);
    expect(mockGetUser).toHaveBeenCalledTimes(2);
  });

  it("retries RPC call on transient network error (#1087)", async () => {
    const mockGetUser = vi
      .fn()
      .mockResolvedValue({ data: { user: { id: "user-1" } } });
    const mockRpc = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce({ data: null, error: null });

    mockedCreateClient.mockResolvedValue({
      auth: { getUser: mockGetUser },
      rpc: mockRpc,
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const response = await DELETE(makeRequest());

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });

  it("returns user-friendly message for transient network errors (#1087)", async () => {
    const fetchError = new TypeError("fetch failed");
    mockedCreateClient.mockRejectedValue(fetchError);

    const response = await DELETE(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe(
      "Account deletion temporarily unavailable, please try again",
    );
  });
});
