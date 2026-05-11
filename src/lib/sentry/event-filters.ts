import type { ErrorEvent } from "@sentry/nextjs";

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
 * Returns true when the Sentry event is a transient network error from a
 * Supabase operation. These are "TypeError: Failed to fetch" or "fetch failed"
 * errors that occur when the browser loses connectivity or the Supabase
 * endpoint is temporarily unreachable. They are not actionable and should
 * be dropped from Sentry entirely to reduce noise.
 *
 * Matches two shapes:
 * 1. Events where the exception value contains "Failed to fetch" or
 *    "fetch failed" — the wrapped Error from `captureSupabaseError`
 * 2. Events reported as "Object captured as exception with keys: code,
 *    details, hint, message" where the extra data contains a transient
 *    network error message — plain objects that bypassed `ensureError`
 */
export function isTransientSupabaseNetworkEvent(event: ErrorEvent): boolean {
  const values = event.exception?.values;
  if (!values || values.length === 0) return false;

  const hasTransientException = values.some((ex) => {
    const val = ex.value ?? "";
    return (
      val.includes("Failed to fetch") ||
      val.includes("fetch failed") ||
      val.includes("Load failed") ||
      val.includes("NetworkError when attempting to fetch resource") ||
      val.includes("The Internet connection appears to be offline") ||
      val.includes("Network request failed")
    );
  });

  if (hasTransientException) return true;

  // Check for plain-object errors that Sentry serialized as
  // "Object captured as exception with keys: code, details, hint, message"
  const hasObjectException = values.some(
    (ex) =>
      typeof ex.value === "string" &&
      ex.value.includes("Object captured as exception with keys:") &&
      ex.value.includes("code") &&
      ex.value.includes("details") &&
      ex.value.includes("message"),
  );

  if (!hasObjectException) return false;

  // Verify the extra data contains a transient network error message
  const extra = event.extra;
  if (!extra) return false;
  const msg =
    typeof extra.message === "string" ? extra.message : "";
  const serialized = extra.__serialized__;
  const serializedMsg =
    serialized &&
    typeof serialized === "object" &&
    "message" in serialized &&
    typeof (serialized as Record<string, unknown>).message === "string"
      ? (serialized as Record<string, string>).message
      : "";

  return (
    msg.includes("Failed to fetch") ||
    msg.includes("fetch failed") ||
    serializedMsg.includes("Failed to fetch") ||
    serializedMsg.includes("fetch failed")
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
