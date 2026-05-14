import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureApiError, captureSupabaseError, isTransientNetworkError } from "@/lib/sentry";
import { retryOnNetworkError } from "@/lib/retry";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await retryOnNetworkError(
      () => supabase.rpc("purge_old_trash"),
      { maxRetries: 1, baseDelayMs: 500 },
    );

    if (error) {
      captureSupabaseError(error, "cron:purge-trash");
      return NextResponse.json(
        { error: "Purge failed" },
        { status: 500 },
      );
    }

    const deletedCount = typeof data === "number" ? data : 0;
    return NextResponse.json({ ok: true, deleted: deletedCount });
  } catch (error) {
    captureApiError(error, "cron:purge-trash");

    const isTransient =
      error instanceof Error && isTransientNetworkError(error);
    return NextResponse.json(
      {
        error: isTransient
          ? "Purge temporarily unavailable, please try again"
          : "Internal server error",
      },
      { status: 500 },
    );
  }
}
