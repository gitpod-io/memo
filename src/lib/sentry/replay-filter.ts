/**
 * Filters for Sentry Replay recording events.
 *
 * Replay hydration errors (`replay.hydrate-error`) are detected by Session
 * Replay's DOM diffing independently of React — `suppressHydrationWarning`
 * and `beforeSend` do not affect them. This filter drops those events at the
 * recording level so they never create Sentry issues.
 */

/**
 * Returns true when a replay recording event is a hydration error breadcrumb.
 *
 * These events are caused by external DOM modification (browser extensions,
 * ad blockers, translation overlays) and are not actionable application bugs.
 * Used as the predicate for `beforeAddRecordingEvent` in `replayIntegration()`.
 */
export function isReplayHydrationError(event: {
  data: { tag: string; payload?: unknown };
}): boolean {
  const payload = event.data.payload;
  return (
    event.data.tag === "breadcrumb" &&
    payload != null &&
    typeof payload === "object" &&
    "category" in payload &&
    (payload as { category: string }).category === "replay.hydrate-error"
  );
}
