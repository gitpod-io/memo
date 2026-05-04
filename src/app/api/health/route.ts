import { NextResponse } from "next/server";

/**
 * Direct-fetch health check. Bypasses the Supabase JS client entirely to
 * avoid GoTrue/Realtime initialization overhead on serverless cold starts.
 * Measures pure network + PostgREST + Postgres round-trip latency.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** Abort health-check fetch after this many milliseconds. */
const TIMEOUT_MS = 2000;

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

  const start = Date.now();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/health_check`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: "{}",
      signal: controller.signal,
    });
    dbLatency = Date.now() - start;

    if (!res.ok) {
      dbStatus = "degraded";
    }
  } catch (err) {
    dbLatency = Date.now() - start;
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
