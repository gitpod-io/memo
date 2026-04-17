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
 * Returns the first successful result, or the last error after all retries
 * are exhausted. Only retries on transient network errors — application-level
 * Supabase errors (e.g. RLS violations) are returned immediately.
 *
 * Accepts both `Promise` and `PromiseLike` return types — Supabase query
 * builders implement `PromiseLike` but not full `Promise`.
 */
export async function retryOnNetworkError<T extends SupabaseResult>(
  fn: () => PromiseLike<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { maxRetries = 2, baseDelayMs = 500 } = options;

  let lastResult = await fn();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (!lastResult.error || !isTransientNetworkError(lastResult.error)) {
      return lastResult;
    }

    await new Promise((resolve) =>
      setTimeout(resolve, baseDelayMs * 2 ** attempt),
    );

    lastResult = await fn();
  }

  return lastResult;
}
