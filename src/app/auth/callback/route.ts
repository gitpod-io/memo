import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  membersWithWorkspaceSlug,
  asMemberWorkspaceSlugRow,
} from "@/lib/supabase/typed-queries";

/**
 * Handles auth redirects from Supabase: email confirmation, OAuth callbacks,
 * and password recovery.
 *
 * Email confirmation: exchanges code → signs out → redirects to /sign-in?confirmed=true
 * OAuth sign-in: exchanges code → keeps session → redirects to user's workspace
 * Password recovery: exchanges code → keeps session → redirects to /reset-password
 * Errors: redirects to /sign-in with error description as query param
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const type = searchParams.get("type");

  // OAuth providers may redirect with error params on denied permission or failure
  const errorParam = searchParams.get("error_description") || searchParams.get("error");
  if (errorParam) {
    const url = new URL("/sign-in", origin);
    url.searchParams.set("error", errorParam);
    return NextResponse.redirect(url);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const url = new URL("/sign-in", origin);
    url.searchParams.set("error", error.message);
    return NextResponse.redirect(url);
  }

  // Password recovery: keep the session active so the user can call updateUser
  if (type === "recovery") {
    return NextResponse.redirect(`${origin}/reset-password`);
  }

  // Determine if this is an OAuth sign-in or email confirmation.
  // OAuth users have an identity with a provider other than "email".
  const isOAuth = data.user?.app_metadata?.provider !== "email";

  if (isOAuth) {
    // OAuth sign-in: session is active, redirect to the user's workspace
    const { data: membership } = await membersWithWorkspaceSlug(supabase)
      .eq("user_id", data.user.id)
      .limit(1)
      .maybeSingle();

    const typed = asMemberWorkspaceSlugRow(membership);
    const slug = typed?.workspaces?.slug;
    return NextResponse.redirect(`${origin}/${slug ?? ""}`);
  }

  // Email confirmation: sign out so they land on sign-in with a success message
  await supabase.auth.signOut();
  return NextResponse.redirect(`${origin}/sign-in?confirmed=true`);
}
