import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          // Ensure every cookie value is a string. During session teardown
          // (e.g. account deletion), the cookie store may return null values
          // for auth chunks. @supabase/ssr's combineChunks passes these to
          // startsWith() without a typeof guard, causing a TypeError.
          // See: https://github.com/supabase/ssr/issues — client-side
          // getItem (line ~146) lacks the typeof guard that the server-side
          // path (line ~253) has.
          return cookieStore.getAll().map(({ name, value }) => ({
            name,
            value: value ?? "",
          }));
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll is called from Server Components where cookies can't be set.
            // This can be ignored if the proxy refreshes the session.
          }
        },
      },
    }
  );
}
