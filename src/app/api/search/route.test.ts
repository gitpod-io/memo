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

import { GET } from "./route";
import { createClient } from "@/lib/supabase/server";

const mockedCreateClient = vi.mocked(createClient);

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost:3000/api/search");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

beforeEach(() => {
  vi.restoreAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";
});

describe("GET /api/search", () => {
  it("returns 503 when Supabase is not configured", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const response = await GET(makeRequest({ q: "test", workspace_id: "ws-1" }) );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("Supabase not configured");
  });

  it("returns 400 when q parameter is missing", async () => {
    const response = await GET(makeRequest({ workspace_id: "ws-1" }) );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Missing required parameters");
  });

  it("returns 400 when workspace_id parameter is missing", async () => {
    const response = await GET(makeRequest({ q: "test" }) );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Missing required parameters");
  });

  it("returns 400 when query exceeds 200 characters", async () => {
    const longQuery = "a".repeat(201);
    const response = await GET(
      makeRequest({ q: longQuery, workspace_id: "ws-1" }) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Query too long");
  });

  it("returns 401 when user is not authenticated", async () => {
    const mockGetUser = vi.fn().mockResolvedValue({ data: { user: null } });
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: mockGetUser },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const response = await GET(
      makeRequest({ q: "test", workspace_id: "ws-1" }) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 500 when RPC call fails", async () => {
    const mockGetUser = vi
      .fn()
      .mockResolvedValue({ data: { user: { id: "user-1" } } });
    const mockRpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "RPC error" } });
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: mockGetUser },
      rpc: mockRpc,
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const response = await GET(
      makeRequest({ q: "test", workspace_id: "ws-1" }) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Search failed");
    expect(mockRpc).toHaveBeenCalledWith("search_pages", {
      query: "test",
      ws_id: "ws-1",
      result_limit: 20,
    });
  });

  it("returns 200 with results on success", async () => {
    const mockResults = [
      {
        id: "page-1",
        workspace_id: "ws-1",
        parent_id: null,
        title: "Test Page",
        icon: "📄",
        snippet: "<<test>> content here",
        rank: 0.5,
      },
    ];
    const mockGetUser = vi
      .fn()
      .mockResolvedValue({ data: { user: { id: "user-1" } } });
    const mockRpc = vi
      .fn()
      .mockResolvedValue({ data: mockResults, error: null });
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: mockGetUser },
      rpc: mockRpc,
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const response = await GET(
      makeRequest({ q: "test", workspace_id: "ws-1" }) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.results).toEqual(mockResults);
  });

  it("returns 200 with empty array when no results", async () => {
    const mockGetUser = vi
      .fn()
      .mockResolvedValue({ data: { user: { id: "user-1" } } });
    const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: mockGetUser },
      rpc: mockRpc,
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const response = await GET(
      makeRequest({ q: "test", workspace_id: "ws-1" }) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.results).toEqual([]);
  });
});
