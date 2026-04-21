import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Handles auth redirects from Supabase: email confirmation and OAuth callbacks.
 *
 * Email confirmation: exchanges code → signs out → redirects to /sign-in?confirmed=true
 * OAuth sign-in: exchanges code → keeps session → redirects to user's workspace
 * Errors: redirects to /sign-in with error description as query param
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

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

  // Determine if this is an OAuth sign-in or email confirmation.
  // OAuth users have an identity with a provider other than "email".
  const isOAuth = data.user?.app_metadata?.provider !== "email";

  if (isOAuth) {
    // OAuth sign-in: session is active, redirect to the user's workspace
    const { data: membership } = await supabase
      .from("members")
      .select("workspaces(slug)")
      .eq("user_id", data.user.id)
      .limit(1)
      .maybeSingle();

    const slug = (membership?.workspaces as unknown as { slug: string } | null)?.slug;
    return NextResponse.redirect(`${origin}/${slug ?? ""}`);
  }

  // Email confirmation: sign out so they land on sign-in with a success message
  await supabase.auth.signOut();
  return NextResponse.redirect(`${origin}/sign-in?confirmed=true`);
}
