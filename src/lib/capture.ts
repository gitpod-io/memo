/**
 * Lazy-load captureException from @sentry/nextjs. Using dynamic import()
 * keeps the Sentry SDK out of page-level JS chunks, reducing first-load
 * bundle size. The SDK is already initialized by instrumentation-client.ts
 * by the time any error handler runs.
 */
export function lazyCaptureException(
  error: unknown,
  opts?: {
    extra?: Record<string, string>;
    level?: "fatal" | "error" | "warning" | "log" | "info" | "debug";
  },
): void {
  import("@sentry/nextjs").then(({ captureException }) => {
    captureException(error, opts);
  });
}
