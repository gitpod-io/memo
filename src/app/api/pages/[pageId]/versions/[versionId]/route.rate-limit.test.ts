import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { _resetRateLimitStore } from "@/lib/rate-limit";

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

const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table === "page_versions") {
        return {
          select: () =>
            createChain({
              data: { content: { root: { children: [] } } },
              error: null,
            }),
          insert: () => createChain({ data: null, error: null }),
        };
      }
      if (table === "pages") {
        return {
          select: () =>
            createChain({
              data: { content: { root: { children: [] } } },
              error: null,
            }),
          update: () => createChain({ data: null, error: null }),
        };
      }
      return { select: () => createChain({ data: null, error: null }) };
    },
  }),
}));

vi.mock("@/lib/sentry", () => ({
  captureApiError: vi.fn(),
  captureSupabaseError: vi.fn(),
  isInsufficientPrivilegeError: () => false,
}));

// Use the REAL withRateLimit — no mock
const { POST } = await import("./route");

function makeRequest(ip = "10.0.0.1"): NextRequest {
  return new NextRequest(
    new URL(
      "/api/pages/page-123/versions/version-456",
      "http://localhost:3000",
    ),
    {
      method: "POST",
      body: JSON.stringify({ action: "restore" }),
      headers: { "x-forwarded-for": ip },
    },
  );
}

const mockParams = Promise.resolve({
  pageId: "page-123",
  versionId: "version-456",
});

beforeEach(() => {
  _resetRateLimitStore();
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
});

describe("POST /api/pages/[pageId]/versions/[versionId] rate limiting", () => {
  it("returns 429 after exceeding 10 requests per minute", async () => {
    for (let i = 0; i < 10; i++) {
      const res = await POST(makeRequest(), { params: mockParams });
      expect(res.status).not.toBe(429);
    }

    const res = await POST(makeRequest(), { params: mockParams });
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("Too many requests");
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("tracks rate limits per IP independently", async () => {
    // Exhaust limit for IP A
    for (let i = 0; i < 10; i++) {
      await POST(makeRequest("10.0.0.1"), { params: mockParams });
    }
    const blockedA = await POST(makeRequest("10.0.0.1"), {
      params: mockParams,
    });
    expect(blockedA.status).toBe(429);

    // IP B should still be allowed
    const allowedB = await POST(makeRequest("10.0.0.2"), {
      params: mockParams,
    });
    expect(allowedB.status).not.toBe(429);
  });

  it("does not rate-limit GET requests", async () => {
    const { GET } = await import("./route");

    for (let i = 0; i < 15; i++) {
      const req = new NextRequest(
        new URL(
          "/api/pages/page-123/versions/version-456",
          "http://localhost:3000",
        ),
        { headers: { "x-forwarded-for": "10.0.0.1" } },
      );
      const res = await GET(req, { params: mockParams });
      expect(res.status).not.toBe(429);
    }
  });
});
