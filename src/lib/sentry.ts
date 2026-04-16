import * as Sentry from "@sentry/nextjs";
import { PostgrestError } from "@supabase/supabase-js";

/**
 * Report a Supabase error to Sentry with structured context.
 *
 * Accepts both PostgrestError (from query/mutation results) and generic Error
 * (from catch blocks). The `operation` tag makes it easy to filter in Sentry
 * by the database operation that failed.
 */
export function captureSupabaseError(
  error: PostgrestError | Error,
  operation: string,
): void {
  const extra: Record<string, string> = {
    operation,
    message: error.message,
  };

  if (error instanceof PostgrestError) {
    extra.code = error.code;
    extra.details = error.details;
    extra.hint = error.hint;
  }

  Sentry.captureException(error, { extra });
}
