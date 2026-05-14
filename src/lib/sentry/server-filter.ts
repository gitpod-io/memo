import type { ErrorEvent } from "@sentry/nextjs";
import { isE2ETestRequest } from "./e2e-detection";
import {
  isNextjsInternalNoise,
  isSupabaseAuthLockContention,
  isTransientSupabaseNetworkEvent,
} from "./event-filters";

/**
 * Returns true when a server-side Sentry event should be dropped.
 * Combines all server-side noise filters into a single call so the
 * server and edge Sentry configs only import one symbol.
 */
export function shouldDropServerEvent(event: ErrorEvent): boolean {
  return (
    isNextjsInternalNoise(event) ||
    isE2ETestRequest(event) ||
    isTransientSupabaseNetworkEvent(event) ||
    isSupabaseAuthLockContention(event)
  );
}
