import { captureSupabaseError } from "@/lib/sentry";
import { retryOnNetworkError } from "@/lib/retry";
import { isUsageTrackingDisabled } from "@/lib/usage-tracking-guard";

/**
 * Server-side product analytics. Inserts a row into `usage_events` using the
 * Supabase server client. Fire-and-forget: errors are captured in Sentry but
 * never thrown or surfaced to the caller.
 *
 * Retries once on transient network errors (e.g. `fetch failed` between
 * Vercel and Supabase) before reporting to Sentry.
 *
 * Use from server components and API routes.
 * For client components, use `trackEventClient` from `@/lib/track-event`.
 */
export async function trackEvent(
  eventName: string,
  userId: string,
  options?: {
    workspaceId?: string;
    pagePath?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  if (isUsageTrackingDisabled()) return;

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { error } = await retryOnNetworkError(
      () =>
        supabase.from("usage_events").insert({
          event_name: eventName,
          user_id: userId,
          workspace_id: options?.workspaceId ?? null,
          page_path: options?.pagePath ?? null,
          metadata: options?.metadata ?? null,
        }),
      { maxRetries: 1, baseDelayMs: 300 },
    );

    if (error) {
      captureSupabaseError(error, `trackEvent:${eventName}`);
    }
  } catch (err) {
    if (err instanceof Error) {
      captureSupabaseError(err, `trackEvent:${eventName}`);
    }
  }
}
