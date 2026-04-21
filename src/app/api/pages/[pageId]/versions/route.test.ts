import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";

// Mock Sentry
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

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

// Chainable query builder that throws when awaited
function createThrowingChain(error: Error) {
  const chain: Record<string, unknown> = {};
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop: string) {
      if (prop === "then") {
        return (_resolve: unknown, reject: (e: Error) => void) => reject(error);
      }
      return () => new Proxy(chain, handler);
    },
  };
  return new Proxy(chain, handler);
}

let listResult: { data: unknown; error: unknown } = { data: [], error: null };
let dedupResult: { data: unknown; error: unknown } = { data: null, error: null };
let insertResult: { data: unknown; error: unknown } = {
  data: { id: "new-version-id", created_at: "2026-04-21T10:00:00Z" },
  error: null,
};
let throwOnInsert: Error | null = null;

const mockGetUser = vi.fn();
let callIndex = 0;

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: () => ({
      select: () => {
        // First select call in POST is the dedup check; in GET it's the list
        const idx = callIndex++;
        if (idx === 0) return createChain(listResult);
        return createChain(dedupResult);
      },
      insert: () => {
        if (throwOnInsert) return createThrowingChain(throwOnInsert);
        return createChain(insertResult);
      },
    }),
  }),
}));

vi.mock("@/lib/sentry", () => ({
  captureSupabaseError: vi.fn(),
  isInsufficientPrivilegeError: (err: Error & { code?: string }) =>
    err.code === "42501" ||
    err.message?.includes("violates row-level security policy"),
}));

const { GET, POST } = await import("./route");

function makeRequest(url: string, init?: { method?: string; body?: string }): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

const mockParams = Promise.resolve({ pageId: "page-123" });

beforeEach(() => {
  vi.clearAllMocks();
  callIndex = 0;
  throwOnInsert = null;
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  listResult = { data: [], error: null };
  dedupResult = { data: null, error: null };
  insertResult = {
    data: { id: "new-version-id", created_at: "2026-04-21T10:00:00Z" },
    error: null,
  };
});

describe("GET /api/pages/[pageId]/versions", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await GET(makeRequest("/api/pages/page-123/versions"), {
      params: mockParams,
    });
    expect(res.status).toBe(401);
  });

  it("returns versions list on success", async () => {
    const versions = [
      { id: "v1", page_id: "page-123", created_at: "2026-04-21T10:00:00Z", created_by: "user-1" },
    ];
    listResult = { data: versions, error: null };

    const res = await GET(makeRequest("/api/pages/page-123/versions"), {
      params: mockParams,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.versions).toEqual(versions);
  });

  it("returns 403 on insufficient privilege", async () => {
    listResult = {
      data: null,
      error: { code: "42501", message: "insufficient_privilege" },
    };

    const res = await GET(makeRequest("/api/pages/page-123/versions"), {
      params: mockParams,
    });
    expect(res.status).toBe(403);
  });
});

describe("POST /api/pages/[pageId]/versions", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(
      makeRequest("/api/pages/page-123/versions", {
        method: "POST",
        body: JSON.stringify({ content: { root: {} } }),
      }),
      { params: mockParams },
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when content is missing", async () => {
    const res = await POST(
      makeRequest("/api/pages/page-123/versions", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: mockParams },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 on empty request body (#380)", async () => {
    const res = await POST(
      makeRequest("/api/pages/page-123/versions", {
        method: "POST",
        body: "",
      }),
      { params: mockParams },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON in request body");
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("returns 400 on malformed JSON body (#380)", async () => {
    const res = await POST(
      makeRequest("/api/pages/page-123/versions", {
        method: "POST",
        body: "{invalid json",
      }),
      { params: mockParams },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON in request body");
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("creates a version on success", async () => {
    // First select = dedup check (no existing version)
    listResult = { data: null, error: null };

    const res = await POST(
      makeRequest("/api/pages/page-123/versions", {
        method: "POST",
        body: JSON.stringify({ content: { root: { children: [] } } }),
      }),
      { params: mockParams },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.version).toBeDefined();
    expect(body.version.id).toBe("new-version-id");
  });

  it("skips when content is identical to latest version", async () => {
    const content = { root: { children: [] } };
    // First select = dedup check returns matching content
    listResult = { data: { content }, error: null };

    const res = await POST(
      makeRequest("/api/pages/page-123/versions", {
        method: "POST",
        body: JSON.stringify({ content }),
      }),
      { params: mockParams },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBe(true);
  });

  it("returns 403 when RLS violation is thrown as exception (MEMO-M regression)", async () => {
    // Simulate Supabase throwing a 42501 error as an exception
    // instead of returning it in { data, error }
    const rlsError = Object.assign(
      new Error("new row violates row-level security policy for table \"page_versions\""),
      { code: "42501", details: null, hint: null },
    );
    throwOnInsert = rlsError;
    // First select = dedup check (no existing version)
    listResult = { data: null, error: null };

    const res = await POST(
      makeRequest("/api/pages/page-123/versions", {
        method: "POST",
        body: JSON.stringify({ content: { root: { children: [] } } }),
      }),
      { params: mockParams },
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Forbidden");
    // Must NOT report to Sentry at error level
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("returns 403 when RLS violation is thrown without PostgrestError shape (MEMO-W regression)", async () => {
    // Simulate Supabase throwing a plain Error without code/details/hint.
    // This is the exact scenario from MEMO-W: the error has the RLS message
    // but lacks PostgrestError properties, so the duck-type check fails.
    const rlsError = new Error(
      'new row violates row-level security policy for table "page_versions"',
    );
    throwOnInsert = rlsError;
    listResult = { data: null, error: null };

    const res = await POST(
      makeRequest("/api/pages/page-123/versions", {
        method: "POST",
        body: JSON.stringify({ content: { root: { children: [] } } }),
      }),
      { params: mockParams },
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Forbidden");
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
