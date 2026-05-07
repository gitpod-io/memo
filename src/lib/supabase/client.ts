import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          if (typeof document === "undefined") return [];
          const parsed = Object.fromEntries(
            document.cookie
              .split("; ")
              .filter(Boolean)
              .map((c) => {
                const [name, ...rest] = c.split("=");
                return [name, rest.join("=")];
              })
          );
          return Object.keys(parsed).map((name) => ({
            name,
            // Guard against null/undefined values from partial cookie
            // deletion during session teardown. @supabase/ssr's
            // combineChunks passes values to startsWith() without a
            // typeof guard, causing a TypeError. Matches the server-side
            // guard in server.ts.
            value: parsed[name] ?? "",
          }));
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            const parts = [`${name}=${encodeURIComponent(value)}`];
            if (options) {
              for (const [key, val] of Object.entries(options)) {
                if (val === true) {
                  parts.push(key);
                } else if (val !== false && val != null) {
                  parts.push(`${key}=${val}`);
                }
              }
            }
            document.cookie = parts.join("; ");
          });
        },
      },
    }
  );
}
