import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { captureApiError, captureSupabaseError, isInsufficientPrivilegeError } from "@/lib/sentry";
import { trackEvent } from "@/lib/track-event-server";
import type { FeedbackType } from "@/lib/types";

const VALID_TYPES: ReadonlySet<FeedbackType> = new Set(["bug", "feature", "general"]);
const MAX_MESSAGE_LENGTH = 500;

export async function POST(request: NextRequest) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (_e) {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { type, message, page_path, page_title, screenshot_url, metadata } =
    body as Record<string, unknown>;

  if (!type || !VALID_TYPES.has(type as FeedbackType)) {
    return NextResponse.json(
      { error: "Invalid type: must be one of bug, feature, general" },
      { status: 400 },
    );
  }

  if (
    typeof message !== "string" ||
    message.trim().length === 0 ||
    message.length > MAX_MESSAGE_LENGTH
  ) {
    return NextResponse.json(
      { error: `Message is required and must not exceed ${MAX_MESSAGE_LENGTH} characters` },
      { status: 400 },
    );
  }

  try {
    const supabase = await createClient();

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase.from("user_feedback").insert({
      user_id: user.user.id,
      type: type as FeedbackType,
      message: message.trim(),
      page_path: (page_path as string) ?? null,
      page_title: (page_title as string) ?? null,
      screenshot_url: (screenshot_url as string) ?? null,
      metadata: (metadata as Record<string, unknown>) ?? null,
    });

    if (error) {
      if (isInsufficientPrivilegeError(error)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      captureSupabaseError(error, "feedback.insert");
      return NextResponse.json(
        { error: "Failed to submit feedback" },
        { status: 500 },
      );
    }

    void trackEvent("feedback.submitted", user.user.id, {
      metadata: { type },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && isInsufficientPrivilegeError(error)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    captureApiError(error, "feedback:submit");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
