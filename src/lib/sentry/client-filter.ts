import type { ErrorEvent } from "@sentry/nextjs";
import { isE2ETestSession } from "./e2e-detection";
import {
  isNextjsInternalNoise,
  isReactLexicalDomConflict,
  isSupabaseAuthLockContention,
  isTransientSupabaseNetworkEvent,
} from "./event-filters";

/**
 * Returns true when a client-side Sentry event should be dropped.
 * Combines all client-side noise filters into a single call so the
 * instrumentation-client entry point only imports one symbol.
 */
export function shouldDropClientEvent(event: ErrorEvent): boolean {
  return (
    isE2ETestSession() ||
    isNextjsInternalNoise(event) ||
    isReactLexicalDomConflict(event) ||
    isSupabaseAuthLockContention(event) ||
    isTransientSupabaseNetworkEvent(event)
  );
}
