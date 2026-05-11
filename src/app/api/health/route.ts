import { NextResponse } from "next/server";

/**
 * Direct-fetch health check. Bypasses the Supabase JS client entirely to
 * avoid GoTrue/Realtime initialization overhead on serverless cold starts.
 *
 * Latency reduction techniques:
 * - GET instead of POST: avoids request body parsing in PostgREST
 * - Connection: keep-alive: reuses TCP+TLS connections within the instance
 * - Prefer: return=minimal: skips response body serialization in PostgREST
 * - Best-of-2 sampling: takes the minimum of two sequential pings to filter
 *   out cold-start connection setup overhead from the reported latency
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** Abort health-check fetch after this many milliseconds. */
const TIMEOUT_MS = 2000;

/** Number of pings to take — report the minimum latency. */
const SAMPLE_COUNT = 2;

/** Shared headers for the health-check fetch. */
function healthHeaders(): Record<string, string> {
  return {
    apikey: SUPABASE_KEY!,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    Prefer: "return=minimal",
    Connection: "keep-alive",
  };
}

/**
 * Single health-check ping. Returns latency in ms and whether the
 * response was ok. Throws on network errors or abort.
 */
async function ping(
  signal: AbortSignal,
): Promise<{ latency: number; ok: boolean }> {
  const start = performance.now();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/health_check`, {
    method: "GET",
    headers: healthHeaders(),
    signal,
    cache: "no-store",
  });
  const latency = Math.round(performance.now() - start);
  return { latency, ok: res.ok };
}

export async function GET() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({
      status: "ok",
      db: { connected: false, latency_ms: 0, reason: "not_configured" },
      timestamp: new Date().toISOString(),
    });
  }

  let dbStatus = "ok";
  let dbLatency = 0;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const start = performance.now();
  try {
    let bestLatency = Infinity;
    let lastOk = true;

    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const result = await ping(controller.signal);
      lastOk = result.ok;
      if (result.latency < bestLatency) {
        bestLatency = result.latency;
      }
    }

    dbLatency = bestLatency === Infinity ? 0 : bestLatency;

    if (!lastOk) {
      dbStatus = "degraded";
    }
  } catch (err) {
    dbLatency = Math.round(performance.now() - start);
    if (err instanceof DOMException && err.name === "AbortError") {
      dbStatus = "degraded";
    } else {
      dbStatus = "down";
    }
  } finally {
    clearTimeout(timer);
  }

  const status = dbStatus === "down" ? "down" : "ok";

  return NextResponse.json({
    status,
    db: { connected: dbStatus !== "down", latency_ms: dbLatency },
    timestamp: new Date().toISOString(),
  });
}
