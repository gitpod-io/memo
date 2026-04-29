import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Chainable query builder that resolves to a configurable result
function createChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop: string) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => resolve(result);
      }
      return () => new Proxy(chain, handler);
    },
  };
  return new Proxy(chain, handler);
}

// Track calls by table name and operation for the multi-step restore flow
let getVersionResult: { data: unknown; error: unknown } = { data: null, error: null };
let getPageResult: { data: unknown; error: unknown } = { data: null, error: null };
let insertVersionResult: { data: unknown; error: unknown } = { data: null, error: null };
let updatePageResult: { data: unknown; error: unknown } = { data: null, error: null };

const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table === "page_versions") {
        return {
          select: () => createChain(getVersionResult),
          insert: () => createChain(insertVersionResult),
        };
      }
      if (table === "pages") {
        // First pages call (idx depends on flow) is select, second is update
        return {
          select: () => createChain(getPageResult),
          update: () => createChain(updatePageResult),
        };
      }
      return { select: () => createChain({ data: null, error: null }) };
    },
  }),
}));

const captureApiErrorMock = vi.fn();

vi.mock("@/lib/sentry", () => ({
  captureApiError: (...args: unknown[]) => captureApiErrorMock(...args),
  captureSupabaseError: vi.fn(),
  isInsufficientPrivilegeError: (err: Error & { code?: string }) =>
    err.code === "42501" ||
    err.message?.includes("violates row-level security policy"),
}));

const { GET, POST } = await import("./route");

function makeRequest(url: string, init?: { method?: string; body?: string }): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

const mockParams = Promise.resolve({ pageId: "page-123", versionId: "version-456" });

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  getVersionResult = { data: null, error: null };
  getPageResult = { data: null, error: null };
  insertVersionResult = { data: null, error: null };
  updatePageResult = { data: null, error: null };
});

describe("GET /api/pages/[pageId]/versions/[versionId]", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await GET(
      makeRequest("/api/pages/page-123/versions/version-456"),
      { params: mockParams },
    );
    expect(res.status).toBe(401);
  });

  it("returns the version on success", async () => {
    const version = {
      id: "version-456",
      page_id: "page-123",
      content: { root: { children: [] } },
      created_at: "2026-04-21T10:00:00Z",
      created_by: "user-1",
    };
    getVersionResult = { data: version, error: null };

    const res = await GET(
      makeRequest("/api/pages/page-123/versions/version-456"),
      { params: mockParams },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.version).toEqual(version);
  });

  it("returns 404 when version not found", async () => {
    getVersionResult = {
      data: null,
      error: { code: "PGRST116", message: "not found" },
    };

    const res = await GET(
      makeRequest("/api/pages/page-123/versions/version-456"),
      { params: mockParams },
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 on insufficient privilege", async () => {
    getVersionResult = {
      data: null,
      error: { code: "42501", message: "insufficient_privilege" },
    };

    const res = await GET(
      makeRequest("/api/pages/page-123/versions/version-456"),
      { params: mockParams },
    );
    expect(res.status).toBe(403);
  });
});

describe("POST /api/pages/[pageId]/versions/[versionId] (restore)", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(
      makeRequest("/api/pages/page-123/versions/version-456", {
        method: "POST",
        body: JSON.stringify({ action: "restore" }),
      }),
      { params: mockParams },
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when action is not restore", async () => {
    const res = await POST(
      makeRequest("/api/pages/page-123/versions/version-456", {
        method: "POST",
        body: JSON.stringify({ action: "delete" }),
      }),
      { params: mockParams },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid action");
  });

  it("returns 404 when version to restore is not found", async () => {
    getVersionResult = {
      data: null,
      error: { code: "PGRST116", message: "not found" },
    };

    const res = await POST(
      makeRequest("/api/pages/page-123/versions/version-456", {
        method: "POST",
        body: JSON.stringify({ action: "restore" }),
      }),
      { params: mockParams },
    );
    expect(res.status).toBe(404);
  });

  it("restores a version successfully", async () => {
    const restoredContent = { root: { children: [{ type: "paragraph" }] } };
    const currentContent = { root: { children: [{ type: "heading" }] } };

    getVersionResult = { data: { content: restoredContent }, error: null };
    getPageResult = { data: { content: currentContent }, error: null };
    insertVersionResult = { data: null, error: null };
    updatePageResult = { data: null, error: null };

    const res = await POST(
      makeRequest("/api/pages/page-123/versions/version-456", {
        method: "POST",
        body: JSON.stringify({ action: "restore" }),
      }),
      { params: mockParams },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.restored).toBe(true);
    expect(body.content).toEqual(restoredContent);
  });

  it("returns 403 when page fetch fails with insufficient privilege", async () => {
    getVersionResult = { data: { content: { root: {} } }, error: null };
    getPageResult = {
      data: null,
      error: { code: "42501", message: "insufficient_privilege" },
    };

    const res = await POST(
      makeRequest("/api/pages/page-123/versions/version-456", {
        method: "POST",
        body: JSON.stringify({ action: "restore" }),
      }),
      { params: mockParams },
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 on empty request body (#380)", async () => {
    const res = await POST(
      makeRequest("/api/pages/page-123/versions/version-456", {
        method: "POST",
        body: "",
      }),
      { params: mockParams },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON in request body");
    expect(captureApiErrorMock).not.toHaveBeenCalled();
  });

  it("returns 400 on malformed JSON body (#380)", async () => {
    const res = await POST(
      makeRequest("/api/pages/page-123/versions/version-456", {
        method: "POST",
        body: "{not valid json",
      }),
      { params: mockParams },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON in request body");
    expect(captureApiErrorMock).not.toHaveBeenCalled();
  });
});
