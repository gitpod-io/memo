/**
 * Returns true when usage event tracking should be suppressed.
 *
 * Two conditions disable tracking:
 * 1. `NEXT_PUBLIC_DISABLE_USAGE_TRACKING` is set to a truthy value — used
 *    during CI / E2E test runs so automation activity never reaches the DB.
 * 2. `NODE_ENV` is `"test"` — unit/integration test runs under Vitest.
 */
export function isUsageTrackingDisabled(): boolean {
  if (process.env.NEXT_PUBLIC_DISABLE_USAGE_TRACKING === "true") return true;
  if (process.env.NODE_ENV === "test") return true;
  return false;
}
