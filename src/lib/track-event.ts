import type { SupabaseClient } from "@supabase/supabase-js";
import { captureSupabaseError } from "@/lib/sentry";

/**
 * Server-side product analytics. Inserts a row into `usage_events` using the
 * Supabase server client. Fire-and-forget: errors are captured in Sentry but
 * never thrown or surfaced to the caller.
 *
 * Use from server components and API routes.
 * For client components, use `trackEventClient` instead.
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
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { error } = await supabase.from("usage_events").insert({
      event_name: eventName,
      user_id: userId,
      workspace_id: options?.workspaceId ?? null,
      page_path: options?.pagePath ?? null,
      metadata: options?.metadata ?? null,
    });

    if (error) {
      captureSupabaseError(error, `trackEvent:${eventName}`);
    }
  } catch (err) {
    if (err instanceof Error) {
      captureSupabaseError(err, `trackEvent:${eventName}`);
    }
  }
}

/**
 * Client-side variant of `trackEvent`. Accepts a Supabase browser client
 * directly (avoids importing the server client which requires `cookies()`).
 * Same fire-and-forget semantics: errors go to Sentry, never thrown.
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
