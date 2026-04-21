import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { captureSupabaseError, isInsufficientPrivilegeError } from "@/lib/sentry";
import { trackEvent } from "@/lib/track-event";

export async function GET(request: NextRequest) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503 }
    );
  }

  const { searchParams } = request.nextUrl;
  const query = searchParams.get("q")?.trim();
  const workspaceId = searchParams.get("workspace_id");

  if (!query || !workspaceId) {
    return NextResponse.json(
      { error: "Missing required parameters: q, workspace_id" },
      { status: 400 }
    );
  }

  if (query.length > 200) {
    return NextResponse.json(
      { error: "Query too long (max 200 characters)" },
      { status: 400 }
    );
  }

  try {
    const supabase = await createClient();

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase.rpc("search_pages", {
      query,
      ws_id: workspaceId,
      result_limit: 20,
    });

    if (error) {
      if (isInsufficientPrivilegeError(error)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      captureSupabaseError(error, "search_pages");
      return NextResponse.json(
        { error: "Search failed" },
        { status: 500 }
      );
    }

    void trackEvent("search.used", user.user.id, {
      workspaceId: workspaceId,
      metadata: { result_count: data?.length ?? 0 },
    });

    return NextResponse.json({ results: data ?? [] });
  } catch (error) {
    if (error instanceof Error && isInsufficientPrivilegeError(error)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    Sentry.captureException(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
