import type { SupabaseClient } from "@supabase/supabase-js";
import { captureSupabaseError } from "@/lib/sentry";
import { isUsageTrackingDisabled } from "@/lib/usage-tracking-guard";

/**
 * Client-side variant of `trackEvent`. Accepts a Supabase browser client
 * directly (avoids importing the server client which requires `cookies()`).
 * Same fire-and-forget semantics: errors go to Sentry, never thrown.
 *
 * For server components and API routes, use `trackEvent` from
 * `@/lib/track-event-server`.
 */
export function trackEventClient(
  supabase: SupabaseClient,
  eventName: string,
  userId: string,
  options?: {
    workspaceId?: string;
    pagePath?: string;
    metadata?: Record<string, unknown>;
  },
): void {
  if (isUsageTrackingDisabled()) return;

  Promise.resolve(
    supabase
      .from("usage_events")
      .insert({
        event_name: eventName,
        user_id: userId,
        workspace_id: options?.workspaceId ?? null,
        page_path: options?.pagePath ?? null,
        metadata: options?.metadata ?? null,
      }),
  )
    .then(({ error }) => {
      if (error) {
        captureSupabaseError(error, `trackEvent:${eventName}`);
      }
    })
    .catch((err: unknown) => {
      if (err instanceof Error) {
        captureSupabaseError(err, `trackEvent:${eventName}`);
      }
    });
}
