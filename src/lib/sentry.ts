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
 * Returns true when the Sentry event is a `NotFoundError` from React's DOM
 * reconciliation conflicting with Lexical's direct DOM manipulation.
 *
 * Lexical manages contentEditable DOM nodes directly for performance. When
 * React's commit phase runs concurrently, it may try to `removeChild` a node
 * that Lexical already removed or reparented, producing a `NotFoundError`.
 * The stack trace contains only React internals — no first-party frames.
 *
 * These errors are harmless (the editor continues working) and not actionable,
 * so they should be dropped from Sentry.
 *
 * See: https://github.com/facebook/lexical/issues/4254
 */
export function isReactLexicalDomConflict(event: ErrorEvent): boolean {
  const values = event.exception?.values;
  if (!values || values.length === 0) return false;

  return values.some(
    (ex) =>
      ex.type === "NotFoundError" &&
      typeof ex.value === "string" &&
      ex.value.includes("removeChild") &&
      hasNoFirstPartyFrames(ex.stacktrace?.frames),
  );
}

/**
 * Returns true when every frame in the stack trace is from a third-party
 * bundle (React internals, Webpack runtime, etc.) — i.e. no application code.
 * An empty or missing frame list also returns true (minified stacks often
 * lack source info).
 */
function hasNoFirstPartyFrames(
  frames: Array<{ filename?: string; abs_path?: string }> | undefined,
): boolean {
  if (!frames || frames.length === 0) return true;

  return !frames.some((frame) => isFirstPartyFrame(frame));
}

/**
 * A frame is first-party when it references application source code rather
 * than bundled third-party libraries. In production builds, Sentry prefixes
 * all client-side frames with `app://` — both first-party and third-party.
 * Third-party frames land in `_next/static/chunks/` with hash-based filenames
 * (e.g. `01jr_next_dist_compiled_react-dom_08~fs09._.js`). First-party frames
 * reference source paths containing `/src/` or `webpack-internal:///`.
 */
function isFirstPartyFrame(frame: {
  filename?: string;
  abs_path?: string;
}): boolean {
  const filename = frame.filename ?? frame.abs_path ?? "";
  return filename.includes("/src/") || filename.includes("webpack-internal:");
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
 *
 * Matches three shapes:
 * 1. PostgrestError objects with `code: "42501"` (from `{ data, error }` path)
 * 2. Generic Error with a `code` property set to `"42501"` (thrown by Supabase
 *    when an RPC rejects via RAISE EXCEPTION with errcode — the error object
 *    has `code` but lacks `details`/`hint` so it fails the PostgrestError check)
 * 3. Generic Error whose message contains the RLS violation pattern
 */
export function isInsufficientPrivilegeError(error: Error): boolean {
  if (isPostgrestError(error)) {
    return error.code === "42501";
  }
  if ("code" in error && (error as Record<string, unknown>).code === "42501") {
    return true;
  }
  return error.message.includes("violates row-level security policy");
}

/**
 * True when PostgreSQL raises `foreign_key_violation` (23503). This occurs
 * when an insert references a row that no longer exists — e.g. creating a
 * page in a workspace that was deleted between page load and the insert.
 * This is an expected race condition during E2E test teardown and concurrent
 * user sessions, not an application bug.
 *
 * Matches two shapes:
 * 1. PostgrestError objects with `code: "23503"` (from `{ data, error }` path)
 * 2. Generic Error with a `code` property set to `"23503"` (thrown path)
 */
export function isForeignKeyViolationError(error: Error): boolean {
  if (isPostgrestError(error)) {
    return error.code === "23503";
  }
  return (
    "code" in error &&
    (error as Record<string, unknown>).code === "23503"
  );
}

/**
 * True when PostgreSQL raises `unique_violation` (23505). This occurs when a
 * concurrent insert races against the same unique constraint — e.g. rapid
 * double-click on "add property" generates the same auto-incremented name
 * before state updates. This is an expected race condition, not an application
 * bug, so it should be reported at warning level.
 *
 * Matches two shapes:
 * 1. PostgrestError objects with `code: "23505"` (from `{ data, error }` path)
 * 2. Generic Error with a `code` property set to `"23505"` (thrown path)
 */
export function isDuplicateKeyError(error: Error): boolean {
  if (isPostgrestError(error)) {
    return error.code === "23505";
  }
  return (
    "code" in error &&
    (error as Record<string, unknown>).code === "23505"
  );
}

/**
 * True when PostgreSQL raises `statement_timeout` (57014). This occurs when a
 * query or RPC exceeds the configured statement timeout — typically during
 * cascading deletes or heavy operations on cold connections. This is a
 * transient infrastructure issue, not an application bug, so it should be
 * reported at warning level.
 *
 * Matches two shapes:
 * 1. PostgrestError objects with `code: "57014"` (from `{ data, error }` path)
 * 2. Generic Error with a `code` property set to `"57014"` (thrown path)
 */
export function isStatementTimeoutError(error: Error): boolean {
  if (isPostgrestError(error)) {
    return error.code === "57014";
  }
  return (
    "code" in error &&
    (error as Record<string, unknown>).code === "57014"
  );
}

/**
 * True when PostgREST returns PGRST116 — "Cannot coerce the result to a
 * single JSON object". This happens when `.single()` finds 0 rows, typically
 * because the target row was deleted between the user action and the lookup
 * (race condition during concurrent deletion or E2E test teardown). The
 * caller already handles the null result gracefully, so this is not an
 * application bug — it should be reported at warning level.
 *
 * See: Sentry MEMO-1P
 */
export function isEmptyResultError(error: Error): boolean {
  return isPostgrestError(error) && error.code === "PGRST116";
}

/**
 * True when PostgREST returns PGRST500 — an internal server error from the
 * PostgREST layer. This may indicate a real server problem, but classifying
 * it explicitly ensures the error code appears in Sentry extra data for
 * consistent grouping and filtering.
 *
 * Kept at error level (not downgraded to warning) since PGRST500 may signal
 * genuine server issues that need investigation.
 *
 * See: Sentry MEMO-22
 */
export function isPostgrestServerError(error: Error): boolean {
  return isPostgrestError(error) && error.code === "PGRST500";
}

/**
 * True when the error is a Supabase Storage API timeout. These are server-side
 * connection pool timeouts returned as HTTP 544 responses, not client-side
 * fetch failures. The `StorageApiError` from `@supabase/storage-js` has
 * `message` and `name` but lacks `code`, `details`, and `hint` — so it fails
 * the `isPostgrestError` check and none of the existing transient classifiers
 * match it.
 *
 * See: Sentry MEMO-1N
 */
export function isTransientStorageError(error: Error): boolean {
  const msg = error.message;
  return (
    msg.includes("The connection to the database timed out") ||
    msg.includes("connection terminated due to connection timeout")
  );
}

/**
 * Node.js native fetch (undici) wraps the real network error in the `cause`
 * property. These substrings in the cause message indicate transient failures.
 */
const NODE_FETCH_CAUSE_PATTERNS = [
  "ECONNRESET",
  "ENOTFOUND",
  "ETIMEDOUT",
  "UND_ERR_SOCKET",
];

/**
 * True when the error originates from Supabase auth lock contention. The
 * Supabase client uses the Web Lock API to serialize token refresh. When
 * multiple concurrent requests race for the lock, the loser gets an
 * `AbortError: Lock broken by another request with the 'steal' option.`
 * This is expected behavior during concurrent page loads — not a bug.
 *
 * Matches two shapes:
 * 1. PostgrestError-like objects where `details` or `message` contains the
 *    lock-stolen AbortError (from `captureSupabaseError` path — MEMO-16/17/19)
 * 2. Plain Error with the lock-released message thrown as an unhandled
 *    rejection by the Supabase auth internals (MEMO-18)
 */
export function isSupabaseAuthLockError(error: Error): boolean {
  const msg = error.message;
  const details = isPostgrestError(error) ? error.details : "";

  return (
    msg.includes("Lock broken by another request") ||
    msg.includes("was released because another request stole it") ||
    details.includes("Lock broken by another request") ||
    details.includes("was released because another request stole it")
  );
}

/**
 * Returns true when the Sentry event is a Supabase auth lock contention
 * error. These are unhandled promise rejections from the Supabase client's
 * internal `_acquireLock` when concurrent requests steal each other's
 * Web Lock API locks. They are harmless and not actionable.
 */
export function isSupabaseAuthLockContention(event: ErrorEvent): boolean {
  const values = event.exception?.values;
  if (!values || values.length === 0) return false;

  return values.some(
    (ex) =>
      typeof ex.value === "string" &&
      (ex.value.includes("Lock broken by another request") ||
        ex.value.includes(
          "was released because another request stole it",
        )),
  );
}

/**
 * True when the error is a transient network failure (e.g. offline, DNS
 * timeout, connection reset). These are not application bugs and should be
 * reported at warning level so they don't trigger error-level alerts.
 *
 * Checks both browser-style fetch errors (top-level message) and Node.js
 * native fetch errors (undici), which use `"fetch failed"` as the message
 * and wrap the real cause (ECONNRESET, ENOTFOUND, etc.) in `error.cause`.
 *
 * When Supabase wraps a Node.js fetch error as a PostgrestError, the message
 * becomes `"TypeError: fetch failed"` and the cause chain (ECONNRESET etc.)
 * is embedded in the `details` string rather than `error.cause`.
 */
export function isTransientNetworkError(error: Error): boolean {
  const msg = error.message;
  const details = isPostgrestError(error) ? error.details : "";

  // Browser-style fetch errors.
  // The Supabase client may append the hostname in parentheses, e.g.
  // "TypeError: Failed to fetch (example.supabase.co)" — use startsWith
  // for patterns that have known suffixes, exact match for the rest.
  if (
    msg.startsWith("TypeError: Failed to fetch") ||
    msg === "Failed to fetch" ||
    msg === "Load failed" ||
    msg === "NetworkError when attempting to fetch resource." ||
    msg === "The Internet connection appears to be offline." ||
    msg === "Network request failed"
  ) {
    return true;
  }

  // Supabase may embed "TypeError: Failed to fetch" in the details field,
  // sometimes with a full stack trace appended.
  if (details.startsWith("TypeError: Failed to fetch")) {
    return true;
  }

  // Node.js native fetch (undici): message is "fetch failed" or
  // "TypeError: fetch failed" (when Supabase wraps the error)
  if (msg === "fetch failed" || msg === "TypeError: fetch failed") {
    return true;
  }

  // Supabase may embed "TypeError: fetch failed" in the details field
  if (details.includes("TypeError: fetch failed")) {
    return true;
  }

  // Node.js native fetch wraps the real error in the cause chain
  const causeMsg = error.cause instanceof Error ? error.cause.message : "";
  if (
    causeMsg &&
    NODE_FETCH_CAUSE_PATTERNS.some((pattern) => causeMsg.includes(pattern))
  ) {
    return true;
  }

  // Supabase PostgrestErrors embed the cause chain in the details string
  if (
    details &&
    NODE_FETCH_CAUSE_PATTERNS.some((pattern) => details.includes(pattern))
  ) {
    return true;
  }

  return false;
}

/**
 * Report an internal API fetch error to Sentry with structured context.
 *
 * Use this for non-Supabase fetch calls (e.g. `/api/pages/…/versions`).
 * Transient network errors are captured at `warning` level to reduce noise.
 * All other errors are captured at `error` level.
 */
export function captureApiError(error: unknown, operation: string): void {
  const extra: Record<string, string> = { operation };

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
    lazyCaptureException(error, { extra, level: "warning" });
    return;
  }

  lazyCaptureException(error, { extra });
}
