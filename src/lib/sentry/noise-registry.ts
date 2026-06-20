import type { ErrorEvent } from "@sentry/nextjs";

/**
 * A declarative entry describing a class of Sentry events that should be
 * dropped as noise. New patterns can be added as data (a registry entry)
 * rather than code (a new function + wiring changes).
 */
export type NoisePattern = {
  /** Short identifier used in logs and tests (e.g. "nextjs-internal-noise"). */
  name: string;
  /** Where this filter applies: client-only, server-only, or both. */
  scope: "client" | "server" | "both";
  /** Predicate — returns true when the event matches this noise pattern. */
  match: (event: ErrorEvent) => boolean;
  /** Why this pattern is noise (for documentation, not used at runtime). */
  reason: string;
};

// ---------------------------------------------------------------------------
// Matching helpers (moved from event-filters.ts)
// ---------------------------------------------------------------------------

const NEXTJS_INTERNAL_NOISE_PATTERNS = [
  "The router state header was sent but could not be parsed",
  // Node.js internal web streams race condition during SSR. The TransformStream
  // controller's state is torn down before the transform algorithm runs.
  // Known issue: vercel/next.js#68319, vercel/next.js#75994.
  "transformAlgorithm is not a function",
];

function matchNextjsInternalNoise(event: ErrorEvent): boolean {
  const values = event.exception?.values;
  if (!values || values.length === 0) return false;

  return values.some((ex) =>
    NEXTJS_INTERNAL_NOISE_PATTERNS.some(
      (pattern) => ex.value?.includes(pattern),
    ),
  );
}

function matchReactLexicalDomConflict(event: ErrorEvent): boolean {
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

function hasNoFirstPartyFrames(
  frames: Array<{ filename?: string; abs_path?: string }> | undefined,
): boolean {
  if (!frames || frames.length === 0) return true;

  return !frames.some((frame) => isFirstPartyFrame(frame));
}

function isFirstPartyFrame(frame: {
  filename?: string;
  abs_path?: string;
}): boolean {
  const filename = frame.filename ?? frame.abs_path ?? "";
  return filename.includes("/src/") || filename.includes("webpack-internal:");
}

function matchTransientSupabaseNetworkEvent(event: ErrorEvent): boolean {
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

/** Filenames that indicate a browser extension injected script. */
const EXTENSION_PATH_PATTERNS = [
  "chrome-extension://",
  "moz-extension://",
  "safari-extension://",
  "app:///scripts/inpage.js",
];

/** Known error messages from browser extensions that are not actionable. */
const EXTENSION_ERROR_MESSAGES = [
  "Failed to connect to MetaMask",
  "MetaMask extension not found",
];

function matchBrowserExtensionNoise(event: ErrorEvent): boolean {
  const values = event.exception?.values;
  if (!values || values.length === 0) return false;

  // Match if any exception value contains a known extension error message
  const hasExtensionMessage = values.some((ex) =>
    EXTENSION_ERROR_MESSAGES.some(
      (msg) => typeof ex.value === "string" && ex.value.includes(msg),
    ),
  );
  if (hasExtensionMessage) return true;

  // Match if ALL exceptions have stack frames exclusively from extension paths
  const allFramesFromExtensions = values.every((ex) => {
    const frames = ex.stacktrace?.frames;
    if (!frames || frames.length === 0) return true;
    return frames.every((frame) => {
      const filename = frame.filename ?? frame.abs_path ?? "";
      return EXTENSION_PATH_PATTERNS.some((pattern) =>
        filename.includes(pattern),
      );
    });
  });

  // Only match if there are actual frames to check (avoid matching frameless events)
  const hasAnyFrames = values.some(
    (ex) => ex.stacktrace?.frames && ex.stacktrace.frames.length > 0,
  );

  return hasAnyFrames && allFramesFromExtensions;
}

function matchSupabaseAuthLockContention(event: ErrorEvent): boolean {
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

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * All known Sentry noise patterns. The `shouldDropClientEvent` and
 * `shouldDropServerEvent` filters iterate this registry instead of
 * calling individual functions.
 *
 * To add a new noise pattern, append an entry here. No other wiring needed.
 */
export const NOISE_REGISTRY: NoisePattern[] = [
  {
    name: "nextjs-internal-noise",
    scope: "both",
    match: matchNextjsInternalNoise,
    reason:
      "Malformed client headers (bots, crawlers, Mobile Safari 17) and " +
      "Node.js web streams race conditions during SSR. Not actionable.",
  },
  {
    name: "react-lexical-dom-conflict",
    scope: "client",
    match: matchReactLexicalDomConflict,
    reason:
      "NotFoundError from React DOM reconciliation conflicting with " +
      "Lexical's direct DOM manipulation. Harmless — editor continues working. " +
      "See: https://github.com/facebook/lexical/issues/4254",
  },
  {
    name: "transient-supabase-network",
    scope: "both",
    match: matchTransientSupabaseNetworkEvent,
    reason:
      "Transient fetch failures (Failed to fetch, Load failed, offline) " +
      "from Supabase operations. Not actionable — caused by client connectivity.",
  },
  {
    name: "browser-extension-noise",
    scope: "client",
    match: matchBrowserExtensionNoise,
    reason:
      "Errors from browser extensions (MetaMask, etc.) injected into the page. " +
      "No application code involved — all stack frames originate from extension scripts.",
  },
  {
    name: "supabase-auth-lock-contention",
    scope: "both",
    match: matchSupabaseAuthLockContention,
    reason:
      "Web Lock API contention from concurrent Supabase auth requests. " +
      "Harmless — the auth client retries internally.",
  },
];

// ---------------------------------------------------------------------------
// Public filter functions (backward-compatible re-exports)
// ---------------------------------------------------------------------------

/**
 * These named functions preserve the existing public API so that the barrel
 * index.ts and unit tests continue to work without changes. Each delegates
 * to the corresponding registry entry's match predicate.
 */

export const isNextjsInternalNoise = matchNextjsInternalNoise;
export const isReactLexicalDomConflict = matchReactLexicalDomConflict;
export const isTransientSupabaseNetworkEvent = matchTransientSupabaseNetworkEvent;
export const isSupabaseAuthLockContention = matchSupabaseAuthLockContention;
export const isBrowserExtensionNoise = matchBrowserExtensionNoise;
