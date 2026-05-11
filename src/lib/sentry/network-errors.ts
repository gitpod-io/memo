import { isPostgrestError } from "./postgrest-errors";

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
  // PostgREST 500 responses may have `details: null` — coalesce to ""
  const details = isPostgrestError(error) ? (error.details ?? "") : "";

  return (
    msg.includes("Lock broken by another request") ||
    msg.includes("was released because another request stole it") ||
    details.includes("Lock broken by another request") ||
    details.includes("was released because another request stole it")
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
  // PostgREST 500 responses may have `details: null` — coalesce to ""
  const details = isPostgrestError(error) ? (error.details ?? "") : "";

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
