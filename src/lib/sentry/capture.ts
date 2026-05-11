import { lazyCaptureException } from "@/lib/capture";
import { isPostgrestError } from "./postgrest-errors";
import {
  isSchemaNotFoundError,
  isInsufficientPrivilegeError,
  isForeignKeyViolationError,
  isDuplicateKeyError,
  isStatementTimeoutError,
  isEmptyResultError,
} from "./postgrest-errors";
import {
  isTransientNetworkError,
  isTransientStorageError,
  isSupabaseAuthLockError,
} from "./network-errors";

/**
 * Ensure the value passed to `lazyCaptureException` is a proper `Error`
 * instance. The Supabase PostgREST client returns plain objects
 * `{ message, details, hint, code }` for network-level fetch failures
 * (see postgrest-js `executeWithRetry` catch handler). Sentry cannot
 * extract a stack trace from plain objects and reports them as
 * "Object captured as exception with keys: …", creating ungrouped noise.
 */
function ensureError(error: Error | { message: string }): Error {
  if (error instanceof Error) return error;
  const wrapped = new Error(error.message);
  wrapped.name = "SupabaseError";
  // Preserve the original object so Sentry extra data still has access
  wrapped.cause = error;
  return wrapped;
}

/**
 * Report an internal API fetch error to Sentry with structured context.
 *
 * Use this for non-Supabase fetch calls (e.g. `/api/pages/…/versions`).
 * Transient network errors are captured at `warning` level to reduce noise.
 * All other errors are captured at `error` level.
 *
 * @param userAgent - Optional User-Agent from the incoming request. Propagated
 *   into `extra.userAgent` so the server-side `beforeSend` filter can detect
 *   E2E test sessions (HeadlessChrome) for manually captured exceptions where
 *   `event.request` is empty.
 */
export function captureApiError(error: unknown, operation: string, userAgent?: string): void {
  const extra: Record<string, string> = { operation };
  if (userAgent) extra.userAgent = userAgent;

  if (error instanceof Error) {
    extra.message = error.message;

    if (isTransientNetworkError(error)) {
      lazyCaptureException(error, { extra, level: "warning" });
      return;
    }
  }

  lazyCaptureException(error, { extra });
}

/**
 * Report a Supabase error to Sentry with structured context.
 *
 * Accepts `PostgrestError` class instances (from `throwOnError()` path),
 * plain objects `{ message, details, hint, code }` (from the default
 * `{ data, error }` pattern when fetch fails), and generic `Error` objects
 * (from catch blocks).
 *
 * Plain objects are wrapped in a proper `Error` before sending to Sentry
 * so they get proper stack traces and grouping instead of appearing as
 * "Object captured as exception with keys: code, details, hint, message".
 *
 * Transient network errors (e.g. `TypeError: Failed to fetch`) are captured at
 * `warning` level to reduce noise — they are not application bugs.
 *
 * @param userAgent - Optional User-Agent from the incoming request. Propagated
 *   into `extra.userAgent` so the server-side `beforeSend` filter can detect
 *   E2E test sessions (HeadlessChrome) for manually captured exceptions where
 *   `event.request` is empty.
 */
export function captureSupabaseError(
  error: Error,
  operation: string,
  userAgent?: string,
): void {
  const extra: Record<string, string> = {
    operation,
    message: error.message,
  };
  if (userAgent) extra.userAgent = userAgent;

  if (isPostgrestError(error)) {
    extra.code = error.code;
    extra.details = error.details ?? "";
    extra.hint = error.hint ?? "";
  }

  // Wrap plain objects in a proper Error for Sentry grouping
  const reportable = ensureError(error);

  if (
    isTransientNetworkError(error) ||
    isTransientStorageError(error) ||
    isSchemaNotFoundError(error) ||
    isInsufficientPrivilegeError(error) ||
    isForeignKeyViolationError(error) ||
    isDuplicateKeyError(error) ||
    isSupabaseAuthLockError(error) ||
    isStatementTimeoutError(error) ||
    isEmptyResultError(error)
  ) {
    lazyCaptureException(reportable, { extra, level: "warning" });
    return;
  }

  lazyCaptureException(reportable, { extra });
}
