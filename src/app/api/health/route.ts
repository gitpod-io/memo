import { NextResponse } from "next/server";

/**
 * Direct-fetch health check. Bypasses the Supabase JS client entirely to
 * avoid GoTrue/Realtime initialization overhead on serverless cold starts.
 *
 * Latency reduction techniques:
 * - GET instead of POST: avoids request body parsing in PostgREST
 * - Connection: keep-alive: reuses TCP+TLS connections within the instance
 * - Prefer: return=minimal: skips response body serialization in PostgREST
 * - Concurrent sampling: runs pings in parallel and takes the minimum to
 *   filter out cold-start outliers without doubling total response time
 *
 * Region co-location: Vercel (fra1) and Supabase (eu-central-1) are both in
 * Frankfurt. Expected latency floor is ~50–150ms for the full round-trip
 * (DNS + TCP + TLS + PostgREST processing). The 500ms threshold accounts
 * for cold-start overhead and connection pool contention.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** Abort health-check fetch after this many milliseconds. */
const TIMEOUT_MS = 2000;

/** Number of pings to take — report the minimum latency. */
const SAMPLE_COUNT = 2;

/** Latency threshold in ms for monitoring. */
const LATENCY_THRESHOLD_MS = 500;

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
  const sampleLatencies: number[] = [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const start = performance.now();
  try {
    // Run pings concurrently to avoid sequential cold-start penalty.
    // Promise.allSettled ensures one failure doesn't abort the other.
    const results = await Promise.allSettled(
      Array.from({ length: SAMPLE_COUNT }, () => ping(controller.signal)),
    );

    let bestLatency = Infinity;
    let anyOk = false;
    let allFailed = true;

    for (const result of results) {
      if (result.status === "fulfilled") {
        allFailed = false;
        sampleLatencies.push(result.value.latency);
        if (result.value.ok) {
          anyOk = true;
        }
        if (result.value.latency < bestLatency) {
          bestLatency = result.value.latency;
        }
      }
    }

    dbLatency = bestLatency === Infinity ? 0 : bestLatency;

    if (allFailed) {
      const firstError =
        results[0].status === "rejected" ? results[0].reason : null;
      if (
        firstError instanceof DOMException &&
        firstError.name === "AbortError"
      ) {
        dbStatus = "degraded";
        dbLatency = Math.round(performance.now() - start);
      } else {
        dbStatus = "down";
        dbLatency = Math.round(performance.now() - start);
      }
    } else if (!anyOk) {
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
    db: {
      connected: dbStatus !== "down",
      latency_ms: dbLatency,
      threshold_ms: LATENCY_THRESHOLD_MS,
      samples: sampleLatencies,
    },
    region: {
      vercel: process.env.VERCEL_REGION ?? "unknown",
      supabase: "eu-central-1",
      colocated: true,
    },
    timestamp: new Date().toISOString(),
  });
}
