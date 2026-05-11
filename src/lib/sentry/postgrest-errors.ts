/**
 * Duck-type check for Supabase PostgrestError shape. Matches both:
 * 1. `PostgrestError` class instances (from `throwOnError()` path) — extend `Error`
 * 2. Plain objects `{ message, details, hint, code }` returned by the Supabase
 *    PostgREST client in the default `{ data, error }` pattern when `fetch` throws
 *    a network error (the client catches the fetch error and returns a plain object
 *    literal, not a `PostgrestError` instance)
 *
 * Does NOT use `instanceof Error` — the Supabase client returns plain objects for
 * network-level failures (see postgrest-js `executeWithRetry` catch handler).
 */
export function isPostgrestError(
  error: unknown,
): error is { message: string; code: string; details: string | null; hint: string | null } {
  if (error == null || typeof error !== "object") return false;
  return (
    "message" in error &&
    "code" in error &&
    "details" in error &&
    "hint" in error
  );
}

/**
 * True when PostgREST cannot find a table in its schema cache (PGRST205).
 * This happens when a migration hasn't been applied or the schema cache is
 * stale. It's a deployment issue, not an application bug, so it should be
 * reported at warning level.
 */
export function isSchemaNotFoundError(error: Error): boolean {
  return isPostgrestError(error) && error.code === "PGRST205";
}

/**
 * True when PostgreSQL raises `insufficient_privilege` (42501). This occurs
 * when an RPC uses `RAISE EXCEPTION` to reject callers who lack access
 * (e.g. non-members calling workspace-scoped functions). It is an expected
 * authorization check, not an application bug — API routes should return 403.
 *
 * Matches three shapes:
 * 1. PostgrestError objects with `code: "42501"` (from `{ data, error }` path)
 * 2. Generic Error with a `code` property set to `"42501"` (thrown by Supabase
 *    when an RPC rejects via RAISE EXCEPTION with errcode — the error object
 *    has `code` but lacks `details`/`hint` so it fails the PostgrestError check)
 * 3. Generic Error whose message contains the RLS violation pattern
 */
export function isInsufficientPrivilegeError(error: Error): boolean {
  if (isPostgrestError(error)) {
    return error.code === "42501";
  }
  if ("code" in error && (error as Record<string, unknown>).code === "42501") {
    return true;
  }
  return error.message.includes("violates row-level security policy");
}

/**
 * True when PostgreSQL raises `foreign_key_violation` (23503). This occurs
 * when an insert references a row that no longer exists — e.g. creating a
 * page in a workspace that was deleted between page load and the insert.
 * This is an expected race condition during E2E test teardown and concurrent
 * user sessions, not an application bug.
 *
 * Matches three shapes:
 * 1. PostgrestError objects with `code: "23503"` (from `{ data, error }` path)
 * 2. Generic Error with a `code` property set to `"23503"` (thrown path)
 * 3. Error whose message contains the FK violation pattern — fallback for
 *    edge cases where the Supabase client returns an error object that
 *    doesn't pass the `isPostgrestError` duck-type check (e.g. missing
 *    `details` or `hint` properties from `.insert().select().single()`)
 */
export function isForeignKeyViolationError(error: Error): boolean {
  if (isPostgrestError(error)) {
    return error.code === "23503";
  }
  if ("code" in error && (error as Record<string, unknown>).code === "23503") {
    return true;
  }
  return error.message.includes("violates foreign key constraint");
}

/**
 * True when PostgreSQL raises `unique_violation` (23505). This occurs when a
 * concurrent insert races against the same unique constraint — e.g. rapid
 * double-click on "add property" generates the same auto-incremented name
 * before state updates. This is an expected race condition, not an application
 * bug, so it should be reported at warning level.
 *
 * Matches two shapes:
 * 1. PostgrestError objects with `code: "23505"` (from `{ data, error }` path)
 * 2. Generic Error with a `code` property set to `"23505"` (thrown path)
 */
export function isDuplicateKeyError(error: Error): boolean {
  if (isPostgrestError(error)) {
    return error.code === "23505";
  }
  return (
    "code" in error &&
    (error as Record<string, unknown>).code === "23505"
  );
}

/**
 * True when PostgreSQL raises `statement_timeout` (57014). This occurs when a
 * query or RPC exceeds the configured statement timeout — typically during
 * cascading deletes or heavy operations on cold connections. This is a
 * transient infrastructure issue, not an application bug, so it should be
 * reported at warning level.
 *
 * Matches two shapes:
 * 1. PostgrestError objects with `code: "57014"` (from `{ data, error }` path)
 * 2. Generic Error with a `code` property set to `"57014"` (thrown path)
 */
export function isStatementTimeoutError(error: Error): boolean {
  if (isPostgrestError(error)) {
    return error.code === "57014";
  }
  return (
    "code" in error &&
    (error as Record<string, unknown>).code === "57014"
  );
}

/**
 * True when PostgREST returns PGRST116 — "Cannot coerce the result to a
 * single JSON object". This happens when `.single()` finds 0 rows, typically
 * because the target row was deleted between the user action and the lookup
 * (race condition during concurrent deletion or E2E test teardown). The
 * caller already handles the null result gracefully, so this is not an
 * application bug — it should be reported at warning level.
 *
 * See: Sentry MEMO-1P
 */
export function isEmptyResultError(error: Error): boolean {
  return isPostgrestError(error) && error.code === "PGRST116";
}

/**
 * True when PostgREST returns PGRST500 — an internal server error from the
 * PostgREST layer. This may indicate a real server problem, but classifying
 * it explicitly ensures the error code appears in Sentry extra data for
 * consistent grouping and filtering.
 *
 * Kept at error level (not downgraded to warning) since PGRST500 may signal
 * genuine server issues that need investigation.
 *
 * See: Sentry MEMO-22
 */
export function isPostgrestServerError(error: Error): boolean {
  return isPostgrestError(error) && error.code === "PGRST500";
}
