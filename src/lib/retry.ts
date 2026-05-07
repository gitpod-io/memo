import { isTransientNetworkError } from "@/lib/sentry";
import { PostgrestError } from "@supabase/supabase-js";

interface RetryOptions {
  /** Maximum number of retry attempts (default: 2). */
  maxRetries?: number;
  /** Base delay in ms before the first retry (default: 500). Doubles each attempt. */
  baseDelayMs?: number;
}

/** Any Supabase query result shape — the only requirement is an `error` field. */
type SupabaseResult = { error: PostgrestError | null };

/**
 * Retry a Supabase query when it fails with a transient network error.
 *
 * Handles both failure modes:
 * - Result-level errors: `{ data: null, error: PostgrestError }` where the
 *   error is a transient network failure.
 * - Thrown errors: Node.js undici `TypeError: fetch failed` that bypasses
 *   the Supabase result pattern entirely.
 *
 * Returns the first successful result, or the last error after all retries
 * are exhausted. Only retries on transient network errors — application-level
 * Supabase errors (e.g. RLS violations) are returned/thrown immediately.
 *
 * Accepts both `Promise` and `PromiseLike` return types — Supabase query
 * builders implement `PromiseLike` but not full `Promise`.
 */
export async function retryOnNetworkError<T extends SupabaseResult>(
  fn: () => PromiseLike<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { maxRetries = 2, baseDelayMs = 500 } = options;

  let lastThrownError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, baseDelayMs * 2 ** (attempt - 1)),
      );
    }

    try {
      const result = await fn();

      // Result-level error: retry only transient network errors
      if (result.error && isTransientNetworkError(result.error)) {
        lastThrownError = null;
        if (attempt < maxRetries) continue;
      }

      return result;
    } catch (error) {
      // Thrown error: retry only transient network errors
      if (error instanceof Error && isTransientNetworkError(error)) {
        lastThrownError = error;
        if (attempt < maxRetries) continue;
      }

      // Non-transient thrown error — do not retry
      throw error;
    }
  }

  // All retries exhausted with a thrown transient error
  if (lastThrownError) {
    throw lastThrownError;
  }

  // This path is unreachable — the loop always returns or throws — but
  // TypeScript cannot prove it, so we satisfy the return type.
  throw new Error("retryOnNetworkError: unexpected state");
}
