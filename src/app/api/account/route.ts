import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { captureSupabaseError } from "@/lib/sentry";

export async function DELETE() {
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

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase.rpc("delete_account");

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
    Sentry.captureException(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
