import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { GET } from "./route";
import { createAdminClient } from "@/lib/supabase/admin";

const mockedCreateAdminClient = vi.mocked(createAdminClient);

function makeRequest(authHeader?: string): Request {
  const headers = new Headers();
  if (authHeader) {
    headers.set("authorization", authHeader);
  }
  return new Request("http://localhost:3000/api/cron/purge-trash", {
    headers,
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  process.env.CRON_SECRET = "test-cron-secret";
});

describe("GET /api/cron/purge-trash", () => {
  it("returns 503 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;

    const response = await GET(makeRequest("Bearer anything"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("CRON_SECRET not configured");
  });

  it("returns 401 when authorization header is missing", async () => {
    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when authorization header is wrong", async () => {
    const response = await GET(makeRequest("Bearer wrong-secret"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 200 with deleted count on success", async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: 5, error: null });
    mockedCreateAdminClient.mockReturnValue({
      rpc: mockRpc,
    } as unknown as ReturnType<typeof createAdminClient>);

    const response = await GET(makeRequest("Bearer test-cron-secret"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.deleted).toBe(5);
    expect(mockRpc).toHaveBeenCalledWith("purge_old_trash");
  });

  it("returns 200 with deleted 0 when no pages purged", async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: 0, error: null });
    mockedCreateAdminClient.mockReturnValue({
      rpc: mockRpc,
    } as unknown as ReturnType<typeof createAdminClient>);

    const response = await GET(makeRequest("Bearer test-cron-secret"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.deleted).toBe(0);
  });

  it("returns 500 when RPC fails", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "DB error", code: "PGRST" },
    });
    mockedCreateAdminClient.mockReturnValue({
      rpc: mockRpc,
    } as unknown as ReturnType<typeof createAdminClient>);

    const response = await GET(makeRequest("Bearer test-cron-secret"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Purge failed");
  });

  it("returns 500 when admin client throws", async () => {
    mockedCreateAdminClient.mockImplementation(() => {
      throw new Error("Missing env vars");
    });

    const response = await GET(makeRequest("Bearer test-cron-secret"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Internal server error");
  });
});
