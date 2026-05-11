import { NextResponse, type NextRequest } from "next/server";

/**
 * In-memory sliding window rate limiter for API routes.
 *
 * Limitation: on serverless platforms (Vercel), each cold start resets the
 * counter. This still protects against burst abuse within a single instance
 * lifetime. For production-grade protection, consider Vercel KV or Upstash Redis.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  /** Maximum requests allowed within the window. */
  limit: number;
  /** Window duration in milliseconds. */
  windowMs: number;
  /**
   * Key extractor — determines how to identify the requester.
   * Return `null` to skip rate limiting for this request (e.g., missing auth).
   */
  keyFn: (request: NextRequest) => string | null | Promise<string | null>;
}

type ApiHandler = (
  request: NextRequest,
  context?: unknown,
) => Promise<NextResponse> | NextResponse;

const store = new Map<string, RateLimitEntry>();

// Periodic cleanup to prevent unbounded memory growth.
// Runs every 60 seconds and removes expired entries.
const CLEANUP_INTERVAL_MS = 60_000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanupTimer(): void {
  if (cleanupTimer !== null) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now >= entry.resetAt) {
        store.delete(key);
      }
    }
    // Stop the timer if the store is empty to avoid keeping the process alive
    if (store.size === 0 && cleanupTimer !== null) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, CLEANUP_INTERVAL_MS);
  // Allow the process to exit even if the timer is running
  if (typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

/**
 * Check rate limit for a given key. Returns the entry and whether the request
 * is allowed.
 */
function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; entry: RateLimitEntry } {
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || now >= existing.resetAt) {
    // Window expired or first request — start a new window
    const entry: RateLimitEntry = { count: 1, resetAt: now + windowMs };
    store.set(key, entry);
    ensureCleanupTimer();
    return { allowed: true, entry };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return { allowed: false, entry: existing };
  }

  return { allowed: true, entry: existing };
}

/**
 * Extract client IP from request headers.
 * Uses x-forwarded-for (set by Vercel/proxies) or x-real-ip as fallback.
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs; the first is the client
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Wraps an API route handler with rate limiting.
 *
 * Usage:
 * ```ts
 * export const POST = withRateLimit(handler, {
 *   limit: 5,
 *   windowMs: 60_000,
 *   keyFn: (req) => getClientIp(req),
 * });
 * ```
 */
export function withRateLimit(handler: ApiHandler, config: RateLimitConfig): ApiHandler {
  return async (request: NextRequest, context: unknown) => {
    const key = await config.keyFn(request);

    // If keyFn returns null, skip rate limiting (e.g., unauthenticated request
    // that will be rejected by the handler itself)
    if (key === null) {
      return handler(request, context);
    }

    const prefixedKey = `rl:${key}`;
    const { allowed, entry } = checkRateLimit(prefixedKey, config.limit, config.windowMs);

    if (!allowed) {
      const retryAfterSeconds = Math.ceil((entry.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(retryAfterSeconds, 1)),
          },
        },
      );
    }

    return handler(request, context);
  };
}

/**
 * Reset the rate limit store. Only for use in tests.
 */
export function _resetRateLimitStore(): void {
  store.clear();
  if (cleanupTimer !== null) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

/**
 * Get the current store size. Only for use in tests.
 */
export function _getStoreSize(): number {
  return store.size;
}
