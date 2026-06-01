import { NextResponse } from "next/server";

/**
 * Direct-fetch health check. Bypasses the Supabase JS client entirely to
 * avoid GoTrue/Realtime initialization overhead on serverless cold starts.
 *
 * Latency reduction techniques:
 * - HEAD instead of GET: avoids response body serialization in PostgREST
 * - Sequential sampling with connection reuse: first ping warms DNS+TCP+TLS,
 *   second ping reuses the connection and measures actual DB round-trip
 *   latency without cold-start overhead
 * - Connection: keep-alive: ensures TCP+TLS reuse between sequential pings
 * - Prefer: return=minimal: skips response body serialization in PostgREST
 *
 * Region co-location is computed dynamically from the VERCEL_REGION env var.
 * Supabase is deployed in eu-central-1 (Frankfurt). Vercel regions starting
 * with common EU prefixes (fra, cdg, lhr, arn, dub) are considered co-located.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** Abort health-check fetch after this many milliseconds. */
const TIMEOUT_MS = 2000;

/** Number of sequential pings — report the last (warm) latency. */
const SAMPLE_COUNT = 2;

/** Latency threshold in ms for monitoring. */
const LATENCY_THRESHOLD_MS = 500;

/** Supabase region identifier. */
const SUPABASE_REGION = "eu-central-1";

/** Vercel region prefixes that are co-located with eu-central-1. */
const EU_REGION_PREFIXES = ["fra", "cdg", "lhr", "arn", "dub"];

/** Check if the Vercel region is co-located with the Supabase region. */
function isColocated(vercelRegion: string): boolean {
  const region = vercelRegion.toLowerCase();
  return EU_REGION_PREFIXES.some((prefix) => region.startsWith(prefix));
}

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
    method: "HEAD",
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
    // Sequential pings: first warms DNS+TCP+TLS, subsequent pings reuse
    // the connection and measure actual DB round-trip latency.
    let anyOk = false;
    let allFailed = true;

    for (let i = 0; i < SAMPLE_COUNT; i++) {
      try {
        const result = await ping(controller.signal);
        allFailed = false;
        sampleLatencies.push(result.latency);
        if (result.ok) {
          anyOk = true;
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          throw err;
        }
        // Individual ping failed; continue to next sample
      }
    }

    // Use the last successful sample (warm connection) as the reported latency.
    // Fall back to the first sample if only one succeeded.
    if (sampleLatencies.length > 0) {
      dbLatency = sampleLatencies[sampleLatencies.length - 1];
    }

    if (allFailed) {
      dbStatus = "down";
      dbLatency = Math.round(performance.now() - start);
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
  const vercelRegion = process.env.VERCEL_REGION ?? "unknown";

  return NextResponse.json({
    status,
    db: {
      connected: dbStatus !== "down",
      latency_ms: dbLatency,
      threshold_ms: LATENCY_THRESHOLD_MS,
      samples: sampleLatencies,
    },
    region: {
      vercel: vercelRegion,
      supabase: SUPABASE_REGION,
      colocated: isColocated(vercelRegion),
    },
    timestamp: new Date().toISOString(),
  });
}
