import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Handles the email confirmation redirect from Supabase Auth.
 * Supabase appends `?code=<auth_code>` to the callback URL.
 * This route exchanges the code for a session, then redirects
 * the user to the sign-in page with a confirmed=true param.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Sign the user out so they land on the sign-in page with a fresh
      // session prompt. The confirmation was successful — they can now
      // sign in with their credentials.
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/sign-in?confirmed=true`);
    }
  }

  // If the code is missing or exchange failed, redirect to sign-in
  // without the success message so the user can try again.
  return NextResponse.redirect(`${origin}/sign-in`);
}
