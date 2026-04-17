import * as Sentry from "@sentry/nextjs";
import { PostgrestError } from "@supabase/supabase-js";

/**
 * True when the error is a transient network failure (e.g. offline, DNS
 * timeout, connection reset). These are not application bugs and should be
 * reported at warning level so they don't trigger error-level alerts.
 */
export function isTransientNetworkError(error: PostgrestError | Error): boolean {
  const msg = error.message;
  const details =
    error instanceof PostgrestError ? error.details : "";

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
  error: PostgrestError | Error,
  operation: string,
): void {
  const extra: Record<string, string> = {
    operation,
    message: error.message,
  };

  if (error instanceof PostgrestError) {
    extra.code = error.code;
    extra.details = error.details;
    extra.hint = error.hint;
  }

  if (isTransientNetworkError(error)) {
    Sentry.captureException(error, { extra, level: "warning" });
    return;
  }

  Sentry.captureException(error, { extra });
}
