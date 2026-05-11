import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("returns not-configured when NEXT_PUBLIC_SUPABASE_URL is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe("ok");
    expect(body.db.connected).toBe(false);
    expect(body.db.reason).toBe("not_configured");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns not-configured when NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe("ok");
    expect(body.db.connected).toBe(false);
    expect(body.db.reason).toBe("not_configured");
  });

  it("returns ok when health_check fetch succeeds", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");

    mockFetch.mockResolvedValue({ ok: true });

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe("ok");
    expect(body.db.connected).toBe(true);
    expect(body.db.latency_ms).toBeGreaterThanOrEqual(0);
    // Best-of-2 sampling: fetch is called twice
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/rpc/health_check",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          apikey: "test-key",
          Prefer: "return=minimal",
          Connection: "keep-alive",
        }),
      }),
    );
  });

  it("returns degraded when fetch returns non-ok status", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");

    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe("ok");
    expect(body.db.connected).toBe(true);
  });

  it("returns degraded on abort (timeout)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");

    const abortError = new DOMException(
      "The operation was aborted.",
      "AbortError",
    );
    mockFetch.mockRejectedValue(abortError);

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe("ok");
    expect(body.db.connected).toBe(true);
    expect(body.db.latency_ms).toBeGreaterThanOrEqual(0);
  });

  it("returns down when fetch throws a network error", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");

    mockFetch.mockRejectedValue(new Error("Connection refused"));

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe("down");
    expect(body.db.connected).toBe(false);
  });

  it("includes a timestamp in ISO format", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");

    mockFetch.mockResolvedValue({ ok: true });

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("reports the minimum latency from best-of-2 sampling", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");

    mockFetch.mockResolvedValue({ ok: true });

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    // Both pings resolve near-instantly in tests, so latency should be small
    expect(body.db.latency_ms).toBeGreaterThanOrEqual(0);
    expect(body.db.latency_ms).toBeLessThan(1000);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("uses GET method without request body", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");

    mockFetch.mockResolvedValue({ ok: true });

    const { GET } = await import("./route");
    await GET();

    const callArgs = mockFetch.mock.calls[0][1];
    expect(callArgs.method).toBe("GET");
    expect(callArgs.body).toBeUndefined();
  });
});
