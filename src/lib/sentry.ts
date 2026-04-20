import type { ErrorEvent } from "@sentry/nextjs";
import { lazyCaptureException } from "@/lib/capture";

// Re-export so existing imports keep working
export { lazyCaptureException } from "@/lib/capture";

/**
 * Duck-type check for Supabase PostgrestError. Avoids importing the class
 * from `@supabase/supabase-js` which would pull the entire SDK (~59 kB)
 * into every page bundle.
 */
function isPostgrestError(
  error: unknown,
): error is { message: string; code: string; details: string; hint: string } {
  return (
    error instanceof Error &&
    "code" in error &&
    "details" in error &&
    "hint" in error
  );
}

/**
 * Error messages from Next.js internals that are caused by clients sending
 * malformed headers (e.g. RSC router state). These are not application bugs —
 * they originate from bots, crawlers, or browser quirks (Mobile Safari 17).
 */
const NEXTJS_INTERNAL_NOISE_PATTERNS = [
  "The router state header was sent but could not be parsed",
];

/**
 * Returns true when the Sentry event represents a Next.js internal error
 * caused by malformed client headers. These are not actionable and should
 * be dropped from Sentry to reduce noise.
 */
export function isNextjsInternalNoise(event: ErrorEvent): boolean {
  const values = event.exception?.values;
  if (!values || values.length === 0) return false;

  return values.some((ex) =>
    NEXTJS_INTERNAL_NOISE_PATTERNS.some(
      (pattern) => ex.value?.includes(pattern),
    ),
  );
}

/**
 * True when the error is a transient network failure (e.g. offline, DNS
 * timeout, connection reset). These are not application bugs and should be
 * reported at warning level so they don't trigger error-level alerts.
 */
export function isTransientNetworkError(error: Error): boolean {
  const msg = error.message;
  const details = isPostgrestError(error) ? error.details : "";

  return (
    msg === "TypeError: Failed to fetch" ||
    details === "TypeError: Failed to fetch" ||
    msg === "Failed to fetch" ||
    msg === "Load failed" ||
    msg === "NetworkError when attempting to fetch resource." ||
    msg === "The Internet connection appears to be offline." ||
    msg === "Network request failed"
  );
}

/**
 * Report a Supabase error to Sentry with structured context.
 *
 * Accepts both PostgrestError (from query/mutation results) and generic Error
 * (from catch blocks). The `operation` tag makes it easy to filter in Sentry
 * by the database operation that failed.
 *
 * Transient network errors (e.g. `TypeError: Failed to fetch`) are captured at
 * `warning` level to reduce noise — they are not application bugs.
 */
export function captureSupabaseError(
  error: Error,
  operation: string,
): void {
  const extra: Record<string, string> = {
    operation,
    message: error.message,
  };

  if (isPostgrestError(error)) {
    extra.code = error.code;
    extra.details = error.details;
    extra.hint = error.hint;
  }

  if (isTransientNetworkError(error)) {
    lazyCaptureException(error, { extra, level: "warning" });
    return;
  }

  lazyCaptureException(error, { extra });
}
