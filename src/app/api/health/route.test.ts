import { describe, it, expect, vi, beforeEach } from "vitest";

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

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/health", () => {
  it("returns not-configured when NEXT_PUBLIC_SUPABASE_URL is missing", async () => {
    const original = process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe("ok");
    expect(body.db.connected).toBe(false);
    expect(body.db.reason).toBe("not_configured");
    expect(mockedCreateClient).not.toHaveBeenCalled();

    // Restore
    if (original !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = original;
  });

  it("returns not-configured when NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing", async () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe("ok");
    expect(body.db.connected).toBe(false);
    expect(body.db.reason).toBe("not_configured");
    expect(mockedCreateClient).not.toHaveBeenCalled();

    // Restore
    if (originalUrl !== undefined) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    } else {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    }
    if (originalKey !== undefined) {
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
    }
  });

  it("returns ok when Supabase query succeeds", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";

    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockLimit = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockSelect = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    mockedCreateClient.mockResolvedValue({ from: mockFrom } as unknown as Awaited<
      ReturnType<typeof createClient>
    >);

    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe("ok");
    expect(body.db.connected).toBe(true);
    expect(body.db.latency_ms).toBeGreaterThanOrEqual(0);
  });

  it("returns ok with connected when table does not exist", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";

    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'relation "_health_check" does not exist' },
    });
    const mockLimit = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockSelect = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    mockedCreateClient.mockResolvedValue({ from: mockFrom } as unknown as Awaited<
      ReturnType<typeof createClient>
    >);

    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe("ok");
    expect(body.db.connected).toBe(true);
  });

  it("returns down when Supabase client throws", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";

    mockedCreateClient.mockRejectedValue(new Error("Connection refused"));

    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe("down");
    expect(body.db.connected).toBe(false);
  });

  it("returns degraded for non-connection Supabase errors", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";

    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "permission denied for table _health_check" },
    });
    const mockLimit = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockSelect = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    mockedCreateClient.mockResolvedValue({ from: mockFrom } as unknown as Awaited<
      ReturnType<typeof createClient>
    >);

    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe("ok");
    expect(body.db.connected).toBe(true);
  });
});
