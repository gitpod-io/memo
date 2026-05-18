import type { ErrorEvent } from "@sentry/nextjs";
import { getIsolationScope } from "@sentry/nextjs";

/**
 * Returns true when the current browser session is an E2E test run.
 *
 * Two detection methods (both synchronous, no race conditions):
 * 1. `window.__SENTRY_DISABLED__` — set by Playwright's `addInitScript`
 * 2. `navigator.userAgent` containing "HeadlessChrome/" — fallback that
 *    works even if the flag hasn't been set yet (e.g. during early page
 *    load before addInitScript executes on a navigation)
 */
export function isE2ETestSession(): boolean {
  if (typeof window === "undefined") return false;

  if (
    (window as unknown as Record<string, unknown>).__SENTRY_DISABLED__ === true
  ) {
    return true;
  }

  // Synchronous fallback: HeadlessChrome is only used by Playwright/Puppeteer.
  // This eliminates the race condition where the __SENTRY_DISABLED__ flag may
  // not be set before Sentry initializes and captures an early error.
  if (
    typeof navigator !== "undefined" &&
    navigator.userAgent.includes("HeadlessChrome/")
  ) {
    return true;
  }

  return false;
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

  // Fallback: check the isolation scope's normalizedRequest headers.
  // Next.js's `captureRequestError` (on_request_error hook) sets request
  // headers in sdkProcessingMetadata.normalizedRequest but does NOT populate
  // event.request — the requestDataIntegration applies it after beforeSend.
  // event.contexts.browser is also unavailable because Sentry's ingestion
  // pipeline enriches it after the SDK sends the event.
  if (isE2ETestFromScope()) return true;

  return false;
}

/**
 * Checks the current isolation scope's normalizedRequest headers for
 * HeadlessChrome. This catches on_request_error events where event.request
 * is null and event.contexts.browser is not yet populated.
 */
function isE2ETestFromScope(): boolean {
  try {
    const scopeData = getIsolationScope().getScopeData();
    const headers = scopeData.sdkProcessingMetadata?.normalizedRequest?.headers;
    if (!headers) return false;

    const scopeUa =
      (headers as Record<string, string>)["user-agent"] ??
      (headers as Record<string, string>)["User-Agent"] ??
      "";
    return scopeUa.includes("HeadlessChrome/");
  } catch (_err: unknown) {
    // getIsolationScope may not be available in all contexts (e.g. tests).
    // Swallowing is intentional — this is a best-effort detection fallback.
    return false;
  }
}
