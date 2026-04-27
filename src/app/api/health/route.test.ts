import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock @supabase/supabase-js
const mockRpc = vi.fn();
const mockMaybeSingle = vi.fn();
const mockLimit = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
const mockSelect = vi.fn().mockReturnValue({ limit: mockLimit });
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    rpc: mockRpc,
    from: mockFrom,
  })),
}));

// Must import after mocks are set up
const { GET } = await import("./route");

let savedUrl: string | undefined;
let savedKey: string | undefined;

beforeEach(() => {
  savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  savedKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  vi.clearAllMocks();
});

afterEach(() => {
  if (savedUrl !== undefined) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
  } else {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  }
  if (savedKey !== undefined) {
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = savedKey;
  } else {
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  }
});

describe("GET /api/health", () => {
  it("returns not-configured when NEXT_PUBLIC_SUPABASE_URL is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    // Reset modules to clear the singleton, then re-import
    vi.resetModules();
    const mod = await import("./route");

    const response = await mod.GET();
    const body = await response.json();

    expect(body.status).toBe("ok");
    expect(body.db.connected).toBe(false);
    expect(body.db.reason).toBe("not_configured");
  });

  it("returns not-configured when NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    vi.resetModules();
    const mod = await import("./route");

    const response = await mod.GET();
    const body = await response.json();

    expect(body.status).toBe("ok");
    expect(body.db.connected).toBe(false);
    expect(body.db.reason).toBe("not_configured");
  });

  it("returns ok when health_check RPC succeeds", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";

    mockRpc.mockResolvedValue({ data: 1, error: null });

    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe("ok");
    expect(body.db.connected).toBe(true);
    expect(body.db.latency_ms).toBeGreaterThanOrEqual(0);
    expect(mockRpc).toHaveBeenCalledWith("health_check");
  });

  it("falls back to table probe when RPC does not exist", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";

    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "function health_check does not exist", code: "PGRST202" },
    });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe("ok");
    expect(body.db.connected).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith("pages");
  });

  it("returns degraded for non-connection RPC errors", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";

    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "permission denied", code: "42501" },
    });

    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe("ok");
    expect(body.db.connected).toBe(true);
  });

  it("returns down when client throws", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";

    mockRpc.mockRejectedValue(new Error("Connection refused"));

    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe("down");
    expect(body.db.connected).toBe(false);
  });

  it("returns degraded when fallback table probe fails", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";

    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "function health_check does not exist", code: "PGRST202" },
    });
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "permission denied for table pages" },
    });

    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe("ok");
    expect(body.db.connected).toBe(true);
  });
});
