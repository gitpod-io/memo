/**
 * Security response headers applied to all routes via next.config.ts.
 *
 * CSP notes:
 * - `style-src 'unsafe-inline'` is required because Tailwind and Lexical inject inline styles.
 * - `script-src 'self'` only — no `'unsafe-eval'` or `'unsafe-inline'` for scripts.
 *   Next.js injects inline scripts with nonces in production, but the framework
 *   handles nonce injection automatically; we don't need `'unsafe-inline'` here.
 * - `connect-src` includes the Supabase project URL for API/auth/realtime calls.
 * - `img-src` includes the Supabase project URL for storage-hosted images, plus
 *   `blob:` and `data:` for client-side image handling (screenshots, CSV export).
 * - `font-src 'self'` only — next/font/google self-hosts fonts at build time.
 * - `worker-src 'self' blob:` — Lexical and other libs may spawn web workers from blob URLs.
 * - The Sentry tunnel route (/monitoring) is same-origin, so no CSP exception needed.
 */

type HeaderEntry = { key: string; value: string };

/**
 * Build the Content-Security-Policy header value.
 * Accepts the Supabase URL so it can be included in connect-src and img-src.
 * Falls back to an empty string if the env var is not set (dev without Supabase).
 */
export function buildCsp(supabaseUrl?: string): string {
  const supabase = supabaseUrl ? ` ${supabaseUrl}` : "";

  const directives = [
    "default-src 'self'",
    "script-src 'self'",
    `style-src 'self' 'unsafe-inline'`,
    "font-src 'self'",
    `img-src 'self'${supabase} blob: data:`,
    `connect-src 'self'${supabase}`,
    `worker-src 'self' blob:`,
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];

  return directives.join("; ");
}

/** All security headers applied to every response. */
export function getSecurityHeaders(supabaseUrl?: string): HeaderEntry[] {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value:
        "camera=(), microphone=(), geolocation=(), browsing-topics=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
    },
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    },
    {
      key: "Content-Security-Policy",
      value: buildCsp(supabaseUrl),
    },
  ];
}
