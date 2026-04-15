import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/headers before importing the route
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}));

// Track the mock so tests can control Supabase behavior
const mockMaybeSingle = vi.fn();
const mockLimit = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ limit: mockLimit }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({ from: mockFrom })),
}));

import { GET } from "./route";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns not_configured when Supabase env vars are missing", async () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    try {
      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.status).toBe("ok");
      expect(body.db.connected).toBe(false);
      expect(body.db.reason).toBe("not_configured");
      // Supabase client should never be created
      expect(mockFrom).not.toHaveBeenCalled();
    } finally {
      // Restore env vars
      if (originalUrl !== undefined)
        process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
      if (originalKey !== undefined)
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
    }
  });

  it("returns not_configured when only URL is missing", async () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";

    try {
      const response = await GET();
      const body = await response.json();

      expect(body.status).toBe("ok");
      expect(body.db.connected).toBe(false);
      expect(body.db.reason).toBe("not_configured");
    } finally {
      if (originalUrl !== undefined)
        process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
      else delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    }
  });

  it("returns ok when Supabase connects (table does not exist)", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";

    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: {
        message: 'relation "public._health_check" does not exist',
        code: "42P01",
      },
    });

    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe("ok");
    expect(body.db.connected).toBe(true);
    expect(body.db.latency_ms).toBeGreaterThanOrEqual(0);
  });

  it("returns ok with connected when query succeeds", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";

    mockMaybeSingle.mockResolvedValue({ data: { "1": 1 }, error: null });

    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe("ok");
    expect(body.db.connected).toBe(true);
  });

  it("returns degraded when Supabase returns a non-missing-table error", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";

    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "permission denied for table _health_check" },
    });

    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe("ok");
    expect(body.db.connected).toBe(true);
    // degraded means connected but with issues
  });

  it("returns down when Supabase client throws", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";

    mockMaybeSingle.mockRejectedValue(new Error("fetch failed"));

    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe("down");
    expect(body.db.connected).toBe(false);
  });
});
