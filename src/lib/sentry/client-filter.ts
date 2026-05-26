import type { ErrorEvent } from "@sentry/nextjs";
import { isE2ETestSession } from "./e2e-detection";
import { NOISE_REGISTRY } from "./noise-registry";

/**
 * Returns true when a client-side Sentry event should be dropped.
 * Iterates the noise registry for all patterns scoped to "client" or "both",
 * plus the E2E test session check.
 */
export function shouldDropClientEvent(event: ErrorEvent): boolean {
  if (isE2ETestSession()) return true;

  return NOISE_REGISTRY.some(
    (pattern) =>
      (pattern.scope === "client" || pattern.scope === "both") &&
      pattern.match(event),
  );
}
