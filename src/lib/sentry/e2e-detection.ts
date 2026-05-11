import type { ErrorEvent } from "@sentry/nextjs";

/**
 * Returns true when the current browser session is an E2E test run.
 * Playwright's auth fixture sets `window.__SENTRY_DISABLED__` via
 * `addInitScript` to prevent simulated errors from generating real
 * Sentry events in production.
 */
export function isE2ETestSession(): boolean {
  return (
    typeof window !== "undefined" &&
    (window as unknown as Record<string, unknown>).__SENTRY_DISABLED__ === true
  );
}

/**
 * Returns true when the Sentry event originated from an E2E test session.
 * On the server side, Playwright runs in HeadlessChrome — the user-agent
 * in the request headers is the only reliable signal since the client-side
 * `window.__SENTRY_DISABLED__` flag is not available server-side.
 *
 * For manually captured exceptions (via `captureException`/`lazyCaptureException`),
 * `event.request` may be empty because the SDK does not auto-attach request
 * context. In that case, fall back to `event.contexts.browser.name` which
 * Sentry's SDK enrichment populates from the browser environment.
 *
 * This complements the client-side `isE2ETestSession()` which uses the
 * window flag set by Playwright's `addInitScript`.
 */
export function isE2ETestRequest(event: ErrorEvent): boolean {
  const ua = event.request?.headers?.["User-Agent"] ?? event.request?.headers?.["user-agent"] ?? "";
  if (ua.includes("HeadlessChrome/")) return true;

  // Fallback: check browser context for manually captured exceptions
  // where request headers are not attached by the SDK
  const browserName = (event.contexts?.browser as Record<string, unknown> | undefined)?.name;
  if (typeof browserName === "string" && browserName.includes("HeadlessChrome")) return true;

  // Fallback: check extra.userAgent propagated by captureSupabaseError /
  // captureApiError from the incoming request's User-Agent header. For
  // server-side manually captured exceptions, event.request is empty and
  // event.contexts.browser is not populated by the SDK — the User-Agent
  // must be explicitly forwarded.
  const extraUa = event.extra?.userAgent;
  if (typeof extraUa === "string" && extraUa.includes("HeadlessChrome/")) return true;

  return false;
}
