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
 * True when PostgREST cannot find a table in its schema cache (PGRST205).
 * This happens when a migration hasn't been applied or the schema cache is
 * stale. It's a deployment issue, not an application bug, so it should be
 * reported at warning level.
 */
export function isSchemaNotFoundError(error: Error): boolean {
  return isPostgrestError(error) && error.code === "PGRST205";
}

/**
 * True when PostgreSQL raises `insufficient_privilege` (42501). This occurs
 * when an RPC uses `RAISE EXCEPTION` to reject callers who lack access
 * (e.g. non-members calling workspace-scoped functions). It is an expected
 * authorization check, not an application bug — API routes should return 403.
 */
export function isInsufficientPrivilegeError(error: Error): boolean {
  return isPostgrestError(error) && error.code === "42501";
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

  if (isTransientNetworkError(error) || isSchemaNotFoundError(error)) {
    lazyCaptureException(error, { extra, level: "warning" });
    return;
  }

  lazyCaptureException(error, { extra });
}
