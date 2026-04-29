import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { captureApiError, captureSupabaseError, isInsufficientPrivilegeError } from "@/lib/sentry";

/**
 * GET /api/pages/[pageId]/versions/[versionId]
 * Returns a single version with its content for preview.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ pageId: string; versionId: string }> },
) {
  const { pageId, versionId } = await params;

  try {
    const supabase = await createClient();

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("page_versions")
      .select("id, page_id, content, created_at, created_by")
      .eq("id", versionId)
      .eq("page_id", pageId)
      .single();

    if (error) {
      if (isInsufficientPrivilegeError(error)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Version not found" }, { status: 404 });
      }
      captureSupabaseError(error, "page-versions:get");
      return NextResponse.json({ error: "Failed to get version" }, { status: 500 });
    }

    return NextResponse.json({ version: data });
  } catch (error) {
    if (error instanceof Error && isInsufficientPrivilegeError(error)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    captureApiError(error, "page-versions:get");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/pages/[pageId]/versions/[versionId]
 * Restores a version: saves current content as a new version, then
 * replaces page content with the selected version's content.
 * Body: { action: "restore" }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string; versionId: string }> },
) {
  const { pageId, versionId } = await params;

  try {
    const supabase = await createClient();

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { action: string };
    try {
      body = await request.json() as typeof body;
    } catch (_e) {
      // Malformed/empty body is a client error, not an application bug — return 400 without Sentry capture
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    if (body.action !== "restore") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Fetch the version to restore
    const { data: version, error: versionError } = await supabase
      .from("page_versions")
      .select("content")
      .eq("id", versionId)
      .eq("page_id", pageId)
      .single();

    if (versionError) {
      if (versionError.code === "PGRST116") {
        return NextResponse.json({ error: "Version not found" }, { status: 404 });
      }
      captureSupabaseError(versionError, "page-versions:restore-fetch");
      return NextResponse.json({ error: "Failed to fetch version" }, { status: 500 });
    }

    // Fetch current page content to save as a new version before overwriting
    const { data: currentPage, error: pageError } = await supabase
      .from("pages")
      .select("content")
      .eq("id", pageId)
      .single();

    if (pageError) {
      if (isInsufficientPrivilegeError(pageError)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      captureSupabaseError(pageError, "page-versions:restore-current");
      return NextResponse.json({ error: "Failed to fetch current page" }, { status: 500 });
    }

    // Save current content as a new version (so it's not lost)
    const { error: snapshotError } = await supabase
      .from("page_versions")
      .insert({
        page_id: pageId,
        content: currentPage.content,
        created_by: authData.user.id,
      });

    if (snapshotError) {
      captureSupabaseError(snapshotError, "page-versions:restore-snapshot");
      return NextResponse.json(
        { error: "Failed to save current version before restore" },
        { status: 500 },
      );
    }

    // Update the page with the restored version's content
    const { error: updateError } = await supabase
      .from("pages")
      .update({ content: version.content })
      .eq("id", pageId);

    if (updateError) {
      captureSupabaseError(updateError, "page-versions:restore-update");
      return NextResponse.json({ error: "Failed to restore version" }, { status: 500 });
    }

    return NextResponse.json({ restored: true, content: version.content });
  } catch (error) {
    if (error instanceof Error && isInsufficientPrivilegeError(error)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    captureApiError(error, "page-versions:restore");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
