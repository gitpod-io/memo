import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { captureApiError, captureSupabaseError, isInsufficientPrivilegeError } from "@/lib/sentry";

/**
 * GET /api/pages/[pageId]/versions
 * Lists versions for a page, newest first. Requires workspace membership.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> },
) {
  const { pageId } = await params;

  try {
    const supabase = await createClient();

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("page_versions")
      .select("id, page_id, created_at, created_by")
      .eq("page_id", pageId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      if (isInsufficientPrivilegeError(error)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      captureSupabaseError(error, "page-versions:list");
      return NextResponse.json({ error: "Failed to list versions" }, { status: 500 });
    }

    return NextResponse.json({ versions: data ?? [] });
  } catch (error) {
    if (error instanceof Error && isInsufficientPrivilegeError(error)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    captureApiError(error, "page-versions:list");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/pages/[pageId]/versions
 * Creates a new version snapshot. Called by the auto-save mechanism.
 * Body: { content: object }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> },
) {
  const { pageId } = await params;

  try {
    const supabase = await createClient();

    const { data: authData } = await supabase.auth.getUser();
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
    const { data: latest } = await supabase
      .from("page_versions")
      .select("content")
      .eq("page_id", pageId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest && JSON.stringify(latest.content) === JSON.stringify(body.content)) {
      return NextResponse.json({ skipped: true });
    }

    const { data, error } = await supabase
      .from("page_versions")
      .insert({
        page_id: pageId,
        content: body.content,
        created_by: authData.user.id,
      })
      .select("id, created_at")
      .single();

    if (error) {
      if (isInsufficientPrivilegeError(error)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      captureSupabaseError(error, "page-versions:create");
      return NextResponse.json({ error: "Failed to create version" }, { status: 500 });
    }

    return NextResponse.json({ version: data });
  } catch (error) {
    if (error instanceof Error && isInsufficientPrivilegeError(error)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    captureApiError(error, "page-versions:create");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
