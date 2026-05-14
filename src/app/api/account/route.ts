import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { captureApiError, captureSupabaseError, isInsufficientPrivilegeError, isTransientNetworkError } from "@/lib/sentry";
import { retryOnNetworkError } from "@/lib/retry";
import { withRateLimit } from "@/lib/rate-limit";

async function handler(_request: NextRequest) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503 }
    );
  }

  try {
    const supabase = await createClient();

    const { data: userData } = await retryOnNetworkError(
      () => supabase.auth.getUser(),
      { maxRetries: 1, baseDelayMs: 500 },
    );
    if (!userData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await retryOnNetworkError(
      () => supabase.rpc("delete_account"),
      { maxRetries: 1, baseDelayMs: 500 },
    );

    if (error) {
      // Sole-owner constraint (P0002) is a user-facing validation error
      if (error.code === "P0002") {
        return NextResponse.json(
          { error: error.message },
          { status: 409 }
        );
      }

      captureSupabaseError(error, "delete_account");
      return NextResponse.json(
        { error: "Account deletion failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && isInsufficientPrivilegeError(error)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    captureApiError(error, "account:delete");

    const isTransient =
      error instanceof Error && isTransientNetworkError(error);
    return NextResponse.json(
      {
        error: isTransient
          ? "Account deletion temporarily unavailable, please try again"
          : "Internal server error",
      },
      { status: 500 },
    );
  }
}

export const DELETE = withRateLimit(handler, {
  limit: 3,
  windowMs: 3_600_000, // 1 hour
  keyFn: async () => {
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      return data.user ? `account:${data.user.id}` : null;
    } catch (_error) {
      // If we can't determine the user, skip rate limiting and let the
      // handler's own auth check return 401.
      return null;
    }
  },
});
