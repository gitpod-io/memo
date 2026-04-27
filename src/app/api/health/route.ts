import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Singleton Supabase client for health checks. Uses the publishable key
 * directly — no cookies, no SSR wrapper — to avoid the per-request overhead
 * of `@supabase/ssr` + `next/headers` cookies().
 */
let healthClient: ReturnType<typeof createClient> | null = null;

function getHealthClient() {
  if (healthClient) return healthClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  healthClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return healthClient;
}

export async function GET() {
  const client = getHealthClient();

  if (!client) {
    return NextResponse.json({
      status: "ok",
      db: { connected: false, latency_ms: 0, reason: "not_configured" },
      timestamp: new Date().toISOString(),
    });
  }

  let dbStatus = "ok";
  let dbLatency = 0;
  const start = Date.now();

  try {
    const { error } = await client.rpc("health_check");
    dbLatency = Date.now() - start;

    if (error) {
      // RPC may not exist yet (migration pending) — fall back to table probe
      if (error.message.includes("does not exist") || error.code === "PGRST202") {
        const fallbackStart = Date.now();
        const { error: fallbackError } = await client
          .from("pages")
          .select("id")
          .limit(1)
          .maybeSingle();
        dbLatency = Date.now() - fallbackStart;
        if (fallbackError && !fallbackError.message.includes("does not exist")) {
          dbStatus = "degraded";
        }
      } else {
        dbStatus = "degraded";
      }
    }
  } catch {
    dbStatus = "down";
    dbLatency = Date.now() - start;
  }

  const status = dbStatus === "down" ? "down" : "ok";

  return NextResponse.json({
    status,
    db: { connected: dbStatus !== "down", latency_ms: dbLatency },
    timestamp: new Date().toISOString(),
  });
}
