import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { captureApiError, captureSupabaseError, isForeignKeyViolationError, isInsufficientPrivilegeError, isTransientNetworkError } from "@/lib/sentry";
import { retryOnNetworkError } from "@/lib/retry";
import { withRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * GET /api/pages/[pageId]/versions
 * Lists versions for a page, newest first. Requires workspace membership.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> },
) {
  const { pageId } = await params;
  const userAgent = request.headers.get("user-agent") ?? undefined;

  try {
    const supabase = await createClient();

    const { data: authData } = await retryOnNetworkError(
      () => supabase.auth.getUser(),
      { maxRetries: 1, baseDelayMs: 500 },
    );
    if (!authData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await retryOnNetworkError(
      () =>
        supabase
          .from("page_versions")
          .select("id, page_id, created_at, created_by")
          .eq("page_id", pageId)
          .order("created_at", { ascending: false })
          .limit(50),
      { maxRetries: 1, baseDelayMs: 500 },
    );

    if (error) {
      if (isInsufficientPrivilegeError(error)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      captureSupabaseError(error, "page-versions:list", userAgent);
      return NextResponse.json({ error: "Failed to list versions" }, { status: 500 });
    }

    return NextResponse.json({ versions: data ?? [] });
  } catch (error) {
    if (error instanceof Error && isInsufficientPrivilegeError(error)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    captureApiError(error, "page-versions:list", userAgent);

    const isTransient =
      error instanceof Error && isTransientNetworkError(error);
    return NextResponse.json(
      {
        error: isTransient
          ? "Version listing temporarily unavailable, please try again"
          : "Internal server error",
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/pages/[pageId]/versions
 * Creates a new version snapshot. Called by the auto-save mechanism.
 * Body: { content: object }
 */
async function postHandler(
  request: NextRequest,
  context: unknown,
) {
  const { pageId } = await (context as { params: Promise<{ pageId: string }> }).params;
  const userAgent = request.headers.get("user-agent") ?? undefined;

  try {
    const supabase = await createClient();

    const { data: authData } = await retryOnNetworkError(
      () => supabase.auth.getUser(),
      { maxRetries: 1, baseDelayMs: 500 },
    );
    if (!authData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { content: Record<string, unknown> | null };
    try {
      body = await request.json() as typeof body;
    } catch (_e) {
      // Malformed/empty body is a client error, not an application bug — return 400 without Sentry capture
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    if (body.content === undefined) {
      return NextResponse.json(
        { error: "Missing required field: content" },
        { status: 400 },
      );
    }

    // Check if the latest version has identical content (deduplication)
    const { data: latest } = await retryOnNetworkError(
      () =>
        supabase
          .from("page_versions")
          .select("content")
          .eq("page_id", pageId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      { maxRetries: 1, baseDelayMs: 500 },
    );

    if (latest && JSON.stringify(latest.content) === JSON.stringify(body.content)) {
      return NextResponse.json({ skipped: true });
    }

    const { data, error } = await retryOnNetworkError(
      () =>
        supabase
          .from("page_versions")
          .insert({
            page_id: pageId,
            content: body.content,
            created_by: authData.user!.id,
          })
          .select("id, created_at")
          .single(),
      { maxRetries: 1, baseDelayMs: 500 },
    );

    if (error) {
      if (isInsufficientPrivilegeError(error)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (isForeignKeyViolationError(error)) {
        return NextResponse.json({ error: "Page not found" }, { status: 404 });
      }
      captureSupabaseError(error, "page-versions:create", userAgent);
      return NextResponse.json({ error: "Failed to create version" }, { status: 500 });
    }

    return NextResponse.json({ version: data });
  } catch (error) {
    if (error instanceof Error && isInsufficientPrivilegeError(error)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (error instanceof Error && isForeignKeyViolationError(error)) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }
    captureApiError(error, "page-versions:create", userAgent);

    const isTransient =
      error instanceof Error && isTransientNetworkError(error);
    return NextResponse.json(
      {
        error: isTransient
          ? "Version creation temporarily unavailable, please try again"
          : "Internal server error",
      },
      { status: 500 },
    );
  }
}

export const POST = withRateLimit(postHandler, {
  limit: 20,
  windowMs: 60_000,
  keyFn: (req) => `page-versions:create:${getClientIp(req)}`,
});

