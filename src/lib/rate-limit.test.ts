import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  withRateLimit,
  getClientIp,
  _resetRateLimitStore,
  _getStoreSize,
} from "./rate-limit";

beforeEach(() => {
  _resetRateLimitStore();
  vi.useRealTimers();
});

afterEach(() => {
  _resetRateLimitStore();
});

function makeRequest(
  url = "http://localhost:3000/api/test",
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(url, { headers });
}

function makeHandler(status = 200): (req: NextRequest) => Promise<NextResponse> {
  return async () => NextResponse.json({ ok: true }, { status });
}

describe("getClientIp", () => {
  it("extracts IP from x-forwarded-for header", () => {
    const req = makeRequest("http://localhost:3000/api/test", {
      "x-forwarded-for": "203.0.113.50, 70.41.3.18, 150.172.238.178",
    });
    expect(getClientIp(req)).toBe("203.0.113.50");
  });

  it("extracts IP from single x-forwarded-for value", () => {
    const req = makeRequest("http://localhost:3000/api/test", {
      "x-forwarded-for": "203.0.113.50",
    });
    expect(getClientIp(req)).toBe("203.0.113.50");
  });

  it("falls back to x-real-ip header", () => {
    const req = makeRequest("http://localhost:3000/api/test", {
      "x-real-ip": "10.0.0.1",
    });
    expect(getClientIp(req)).toBe("10.0.0.1");
  });

  it("prefers x-forwarded-for over x-real-ip", () => {
    const req = makeRequest("http://localhost:3000/api/test", {
      "x-forwarded-for": "203.0.113.50",
      "x-real-ip": "10.0.0.1",
    });
    expect(getClientIp(req)).toBe("203.0.113.50");
  });

  it("returns 'unknown' when no IP headers present", () => {
    const req = makeRequest();
    expect(getClientIp(req)).toBe("unknown");
  });
});

describe("withRateLimit", () => {
  it("passes requests through when under the limit", async () => {
    const handler = makeHandler();
    const limited = withRateLimit(handler, {
      limit: 3,
      windowMs: 60_000,
      keyFn: () => "test-key",
    });

    const req = makeRequest();
    const res = await limited(req, undefined);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("allows exactly `limit` requests within the window", async () => {
    const handler = makeHandler();
    const limited = withRateLimit(handler, {
      limit: 3,
      windowMs: 60_000,
      keyFn: () => "test-key",
    });

    const req = makeRequest();
    for (let i = 0; i < 3; i++) {
      const res = await limited(req, undefined);
      expect(res.status).toBe(200);
    }
  });

  it("returns 429 when limit is exceeded", async () => {
    const handler = makeHandler();
    const limited = withRateLimit(handler, {
      limit: 2,
      windowMs: 60_000,
      keyFn: () => "test-key",
    });

    const req = makeRequest();
    await limited(req, undefined); // 1
    await limited(req, undefined); // 2
    const res = await limited(req, undefined); // 3 — over limit
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toBe("Too many requests");
  });

  it("includes Retry-After header in 429 response", async () => {
    const handler = makeHandler();
    const limited = withRateLimit(handler, {
      limit: 1,
      windowMs: 60_000,
      keyFn: () => "test-key",
    });

    const req = makeRequest();
    await limited(req, undefined); // 1
    const res = await limited(req, undefined); // 2 — over limit

    expect(res.status).toBe(429);
    const retryAfter = res.headers.get("Retry-After");
    expect(retryAfter).toBeTruthy();
    const seconds = parseInt(retryAfter!, 10);
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThanOrEqual(60);
  });

  it("resets the counter after the window expires", async () => {
    vi.useFakeTimers();

    const handler = makeHandler();
    const limited = withRateLimit(handler, {
      limit: 1,
      windowMs: 10_000,
      keyFn: () => "test-key",
    });

    const req = makeRequest();
    const res1 = await limited(req, undefined);
    expect(res1.status).toBe(200);

    const res2 = await limited(req, undefined);
    expect(res2.status).toBe(429);

    // Advance time past the window
    vi.advanceTimersByTime(11_000);

    const res3 = await limited(req, undefined);
    expect(res3.status).toBe(200);

    vi.useRealTimers();
  });

  it("tracks different keys independently", async () => {
    let currentKey = "user-a";
    const handler = makeHandler();
    const limited = withRateLimit(handler, {
      limit: 1,
      windowMs: 60_000,
      keyFn: () => currentKey,
    });

    const req = makeRequest();

    // User A: first request passes
    const resA1 = await limited(req, undefined);
    expect(resA1.status).toBe(200);

    // User A: second request blocked
    const resA2 = await limited(req, undefined);
    expect(resA2.status).toBe(429);

    // User B: first request passes (different key)
    currentKey = "user-b";
    const resB1 = await limited(req, undefined);
    expect(resB1.status).toBe(200);
  });

  it("skips rate limiting when keyFn returns null", async () => {
    const handler = makeHandler();
    const limited = withRateLimit(handler, {
      limit: 1,
      windowMs: 60_000,
      keyFn: () => null,
    });

    const req = makeRequest();

    // Should pass through unlimited
    for (let i = 0; i < 5; i++) {
      const res = await limited(req, undefined);
      expect(res.status).toBe(200);
    }
  });

  it("supports async keyFn", async () => {
    const handler = makeHandler();
    const limited = withRateLimit(handler, {
      limit: 1,
      windowMs: 60_000,
      keyFn: async () => "async-key",
    });

    const req = makeRequest();
    const res1 = await limited(req, undefined);
    expect(res1.status).toBe(200);

    const res2 = await limited(req, undefined);
    expect(res2.status).toBe(429);
  });

  it("does not call the handler when rate limited", async () => {
    const handlerFn = vi.fn().mockResolvedValue(
      NextResponse.json({ ok: true }),
    );
    const limited = withRateLimit(handlerFn, {
      limit: 1,
      windowMs: 60_000,
      keyFn: () => "test-key",
    });

    const req = makeRequest();
    await limited(req, undefined); // 1 — handler called
    await limited(req, undefined); // 2 — rate limited, handler NOT called

    expect(handlerFn).toHaveBeenCalledTimes(1);
  });

  it("stores entries and cleans up", () => {
    expect(_getStoreSize()).toBe(0);
  });
});

describe("sliding window behavior", () => {
  it("counts requests within the same window", async () => {
    vi.useFakeTimers();

    const handler = makeHandler();
    const limited = withRateLimit(handler, {
      limit: 3,
      windowMs: 10_000,
      keyFn: () => "window-test",
    });

    const req = makeRequest();

    // Make 3 requests at different times within the window
    await limited(req, undefined); // t=0
    vi.advanceTimersByTime(3_000);
    await limited(req, undefined); // t=3s
    vi.advanceTimersByTime(3_000);
    await limited(req, undefined); // t=6s

    // 4th request at t=6s should be blocked (window started at t=0, expires at t=10s)
    const res = await limited(req, undefined);
    expect(res.status).toBe(429);

    vi.useRealTimers();
  });

  it("starts a new window after expiry", async () => {
    vi.useFakeTimers();

    const handler = makeHandler();
    const limited = withRateLimit(handler, {
      limit: 2,
      windowMs: 5_000,
      keyFn: () => "expiry-test",
    });

    const req = makeRequest();

    await limited(req, undefined); // 1
    await limited(req, undefined); // 2
    const blocked = await limited(req, undefined); // 3 — blocked
    expect(blocked.status).toBe(429);

    // Advance past the window
    vi.advanceTimersByTime(6_000);

    // New window — should allow again
    const res = await limited(req, undefined);
    expect(res.status).toBe(200);

    vi.useRealTimers();
  });
});
