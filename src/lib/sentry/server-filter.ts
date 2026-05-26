import type { ErrorEvent } from "@sentry/nextjs";
import { isE2ETestRequest } from "./e2e-detection";
import { NOISE_REGISTRY } from "./noise-registry";

/**
 * Returns true when a server-side Sentry event should be dropped.
 * Iterates the noise registry for all patterns scoped to "server" or "both",
 * plus the E2E test request check.
 */
export function shouldDropServerEvent(event: ErrorEvent): boolean {
  if (isE2ETestRequest(event)) return true;

  return NOISE_REGISTRY.some(
    (pattern) =>
      (pattern.scope === "server" || pattern.scope === "both") &&
      pattern.match(event),
  );
}
