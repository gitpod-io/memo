import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";
import { PostgrestError } from "@supabase/supabase-js";

const captureExceptionMock = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => captureExceptionMock(...args),
}));

import {
  isTransientNetworkError,
  isTransientStorageError,
  isSchemaNotFoundError,
  isInsufficientPrivilegeError,
  isForeignKeyViolationError,
  isDuplicateKeyError,
  isStatementTimeoutError,
  isEmptyResultError,
  isPostgrestServerError,
  isSupabaseAuthLockError,
  isSupabaseAuthLockContention,
  isTransientSupabaseNetworkEvent,
  captureSupabaseError,
  captureApiError,
  isNextjsInternalNoise,
  isReactLexicalDomConflict,
  isE2ETestSession,
  isE2ETestRequest,
} from ".";

function makePostgrestError(
  overrides: Partial<PostgrestError> = {},
): PostgrestError {
  const err = new PostgrestError({
    message: overrides.message ?? "some error",
    details: overrides.details ?? "",
    hint: overrides.hint ?? "",
    code: overrides.code ?? "PGRST000",
  });
  return err;
}

/**
 * Create a plain object matching the shape returned by the Supabase PostgREST
 * client when `fetch` throws a network error in the default (non-throwOnError)
 * mode. These are NOT `PostgrestError` instances — they are plain object
 * literals `{ message, details, hint, code }`.
 *
 * See: postgrest-js `executeWithRetry` catch handler.
 */
function makePlainSupabaseError(
  overrides: { message?: string; details?: string; hint?: string; code?: string } = {},
): { message: string; code: string; details: string; hint: string } {
  return {
    message: overrides.message ?? "TypeError: Failed to fetch",
    details: overrides.details ?? "",
    hint: overrides.hint ?? "",
    code: overrides.code ?? "",
  };
}

describe("isTransientNetworkError", () => {
  it("detects 'TypeError: Failed to fetch' in message", () => {
    const error = new Error("TypeError: Failed to fetch");
    expect(isTransientNetworkError(error)).toBe(true);
  });

  it("detects 'Failed to fetch' in message", () => {
    const error = new Error("Failed to fetch");
    expect(isTransientNetworkError(error)).toBe(true);
  });

  it("detects 'Load failed' (Safari)", () => {
    const error = new Error("Load failed");
    expect(isTransientNetworkError(error)).toBe(true);
  });

  it("detects 'NetworkError when attempting to fetch resource.' (Firefox)", () => {
    const error = new Error(
      "NetworkError when attempting to fetch resource.",
    );
    expect(isTransientNetworkError(error)).toBe(true);
  });

  it("detects 'The Internet connection appears to be offline.'", () => {
    const error = new Error(
      "The Internet connection appears to be offline.",
    );
    expect(isTransientNetworkError(error)).toBe(true);
  });

  it("detects 'Network request failed'", () => {
    const error = new Error("Network request failed");
    expect(isTransientNetworkError(error)).toBe(true);
  });

  it("detects 'TypeError: Failed to fetch' in PostgrestError details", () => {
    const error = makePostgrestError({
      message: "some wrapper message",
      details: "TypeError: Failed to fetch",
    });
    expect(isTransientNetworkError(error)).toBe(true);
  });

  it("detects Node.js native fetch 'fetch failed' message", () => {
    const error = new Error("fetch failed");
    expect(isTransientNetworkError(error)).toBe(true);
  });

  it("detects ECONNRESET in error cause chain (Node.js native fetch)", () => {
    const cause = new Error(
      "Client network socket disconnected before secure TLS connection was established",
    );
    cause.message += " (ECONNRESET)";
    const error = new Error("fetch failed", { cause });
    expect(isTransientNetworkError(error)).toBe(true);
  });

  it("detects ENOTFOUND in error cause chain (DNS failure)", () => {
    const cause = new Error("getaddrinfo ENOTFOUND example.com");
    const error = new Error("fetch failed", { cause });
    expect(isTransientNetworkError(error)).toBe(true);
  });

  it("detects ETIMEDOUT in error cause chain (connection timeout)", () => {
    const cause = new Error("connect ETIMEDOUT 10.0.0.1:443");
    const error = new Error("fetch failed", { cause });
    expect(isTransientNetworkError(error)).toBe(true);
  });

  it("detects UND_ERR_SOCKET in error cause chain (undici socket error)", () => {
    const cause = new Error("other side closed - Loss of signal (UND_ERR_SOCKET)");
    const error = new Error("fetch failed", { cause });
    expect(isTransientNetworkError(error)).toBe(true);
  });

  it("detects cause chain errors even when top-level message is not 'fetch failed'", () => {
    const cause = new Error("connect ECONNRESET 10.0.0.1:443");
    const error = new Error("request to https://example.com failed", { cause });
    expect(isTransientNetworkError(error)).toBe(true);
  });

  it("returns false when cause exists but is not a transient network error", () => {
    const cause = new Error("SQLITE_BUSY: database is locked");
    const error = new Error("fetch failed", { cause });
    // "fetch failed" message alone is enough to be transient
    expect(isTransientNetworkError(error)).toBe(true);
  });

  it("detects 'TypeError: fetch failed' message (Supabase-wrapped Node.js fetch)", () => {
    const error = new Error("TypeError: fetch failed");
    expect(isTransientNetworkError(error)).toBe(true);
  });

  it("detects 'TypeError: fetch failed' in PostgrestError message", () => {
    const error = makePostgrestError({
      message: "TypeError: fetch failed",
      details:
        "TypeError: fetch failed\n\nCaused by: Error: Client network socket disconnected before secure TLS connection was established (ECONNRESET)",
    });
    expect(isTransientNetworkError(error)).toBe(true);
  });

  it("detects ECONNRESET in PostgrestError details (Supabase cause chain)", () => {
    const error = makePostgrestError({
      message: "some wrapper message",
      details:
        "TypeError: fetch failed\n\nCaused by: Error: connect ECONNRESET 10.0.0.1:443",
    });
    expect(isTransientNetworkError(error)).toBe(true);
  });

  it("detects ENOTFOUND in PostgrestError details", () => {
    const error = makePostgrestError({
      message: "some wrapper message",
      details: "getaddrinfo ENOTFOUND db.example.com",
    });
    expect(isTransientNetworkError(error)).toBe(true);
  });

  it("detects ETIMEDOUT in PostgrestError details", () => {
    const error = makePostgrestError({
      message: "some wrapper message",
      details: "connect ETIMEDOUT 10.0.0.1:443",
    });
    expect(isTransientNetworkError(error)).toBe(true);
  });

  it("detects 'TypeError: Failed to fetch' with Supabase hostname suffix (MEMO-1A regression)", () => {
    const error = new Error(
      "TypeError: Failed to fetch (yoipusltrtbvneuywzkj.supabase.co)",
    );
    expect(isTransientNetworkError(error)).toBe(true);
  });

  it("detects 'TypeError: Failed to fetch' with stack trace in PostgrestError details (MEMO-1A regression)", () => {
    const error = makePostgrestError({
      message: "TypeError: Failed to fetch (yoipusltrtbvneuywzkj.supabase.co)",
      details:
        "TypeError: Failed to fetch\n    at https://memo.software-factory.dev/_next/static/chunks/0vbg59c79mvs4.js:20:1653",
    });
    expect(isTransientNetworkError(error)).toBe(true);
  });

  it("returns false when cause is not an Error instance", () => {
    const error = new Error("some error", { cause: "string cause" });
    expect(isTransientNetworkError(error)).toBe(false);
  });

  it("returns false for a regular PostgrestError", () => {
    const error = makePostgrestError({
      message: "new row violates row-level security policy",
      code: "42501",
    });
    expect(isTransientNetworkError(error)).toBe(false);
  });

  it("returns false for a generic application error", () => {
    const error = new Error("Something went wrong");
    expect(isTransientNetworkError(error)).toBe(false);
  });

  // --- Plain object regression tests (MEMO-E / MEMO-C / #828) ---
  // The Supabase PostgREST client returns plain objects (not PostgrestError
  // instances) when fetch throws a network error in the default mode.

  it("detects 'TypeError: Failed to fetch' from plain Supabase error object (#828 MEMO-E)", () => {
    const error = makePlainSupabaseError({
      message: "TypeError: Failed to fetch (yoipusltrtbvneuywzkj.supabase.co)",
      details:
        "TypeError: Failed to fetch\n    at https://memo.software-factory.dev/_next/static/chunks/0vf8__som4qot.js:20:1653",
    });
    expect(isTransientNetworkError(error as unknown as Error)).toBe(true);
  });

  it("detects 'TypeError: Failed to fetch' from plain object with empty code (#828 MEMO-C)", () => {
    const error = makePlainSupabaseError({
      message: "TypeError: Failed to fetch (yoipusltrtbvneuywzkj.supabase.co)",
      details:
        "TypeError: Failed to fetch\n    at http://localhost:3000/_next/static/chunks/0.rz_@sentry_core.js:6673:34",
      code: "",
    });
    expect(isTransientNetworkError(error as unknown as Error)).toBe(true);
  });

  // --- Null details regression test (MEMO-2E / #944) ---
  // PostgREST 500 responses return `details: null`. The `in` operator in
  // isPostgrestError passes (key exists), but `null.startsWith()` crashes.

  it("does not crash when PostgREST error has details: null (#944 MEMO-2E)", () => {
    const error = { message: "server error", code: "XX000", details: null, hint: null };
    expect(() => isTransientNetworkError(error as unknown as Error)).not.toThrow();
    expect(isTransientNetworkError(error as unknown as Error)).toBe(false);
  });

  it("still detects transient fetch error when details is null but message matches (#944 MEMO-2E)", () => {
    const error = { message: "TypeError: fetch failed", code: "XX000", details: null, hint: null };
    expect(isTransientNetworkError(error as unknown as Error)).toBe(true);
  });
});

describe("isSchemaNotFoundError", () => {
  it("detects PGRST205 (table not found in schema cache)", () => {
    const error = makePostgrestError({
      message: "Could not find the table 'public.favorites' in the schema cache",
      code: "PGRST205",
      hint: "Perhaps you meant the table 'public.profiles'",
    });
    expect(isSchemaNotFoundError(error)).toBe(true);
  });

  it("returns false for other PostgrestError codes", () => {
    const error = makePostgrestError({
      message: "new row violates row-level security policy",
      code: "42501",
    });
    expect(isSchemaNotFoundError(error)).toBe(false);
  });

  it("returns false for generic errors", () => {
    const error = new Error("Something went wrong");
    expect(isSchemaNotFoundError(error)).toBe(false);
  });
});

describe("isInsufficientPrivilegeError", () => {
  it("detects PostgreSQL 42501 (insufficient_privilege)", () => {
    const error = makePostgrestError({
      message: "Not a member of this workspace",
      code: "42501",
    });
    expect(isInsufficientPrivilegeError(error)).toBe(true);
  });

  it("returns false for other PostgrestError codes", () => {
    const error = makePostgrestError({
      message: "duplicate key",
      code: "23505",
    });
    expect(isInsufficientPrivilegeError(error)).toBe(false);
  });

  it("returns false for PGRST205 errors", () => {
    const error = makePostgrestError({
      message: "Could not find the table",
      code: "PGRST205",
    });
    expect(isInsufficientPrivilegeError(error)).toBe(false);
  });

  it("returns false for generic errors without RLS message", () => {
    const error = new Error("Something went wrong");
    expect(isInsufficientPrivilegeError(error)).toBe(false);
  });

  it("detects RLS violation from generic Error message (MEMO-W regression)", () => {
    const error = new Error(
      'new row violates row-level security policy for table "page_versions"',
    );
    expect(isInsufficientPrivilegeError(error)).toBe(true);
  });

  it("detects RLS violation from generic Error with different table name", () => {
    const error = new Error(
      'new row violates row-level security policy for table "pages"',
    );
    expect(isInsufficientPrivilegeError(error)).toBe(true);
  });

  it("detects custom RPC 42501 thrown as Error with code property (MEMO-14 regression)", () => {
    const error = Object.assign(
      new Error("Not a member of this workspace"),
      { code: "42501" },
    );
    expect(isInsufficientPrivilegeError(error)).toBe(true);
  });

  it("detects RPC 42501 with code but without details/hint (non-PostgrestError shape)", () => {
    const error = Object.assign(
      new Error("Workspace access denied"),
      { code: "42501", details: null, hint: null },
    );
    expect(isInsufficientPrivilegeError(error)).toBe(true);
  });

  it("returns false for generic Error with non-42501 code property", () => {
    const error = Object.assign(
      new Error("duplicate key"),
      { code: "23505" },
    );
    expect(isInsufficientPrivilegeError(error)).toBe(false);
  });
});

describe("isForeignKeyViolationError", () => {
  it("detects PostgreSQL 23503 (foreign_key_violation) from PostgrestError", () => {
    const error = makePostgrestError({
      message: 'insert or update on table "pages" violates foreign key constraint "pages_workspace_id_fkey"',
      code: "23503",
    });
    expect(isForeignKeyViolationError(error)).toBe(true);
  });

  it("detects 23503 from generic Error with code property (thrown path)", () => {
    const error = Object.assign(
      new Error('insert or update on table "pages" violates foreign key constraint "pages_workspace_id_fkey"'),
      { code: "23503" },
    );
    expect(isForeignKeyViolationError(error)).toBe(true);
  });

  it("returns false for other PostgrestError codes", () => {
    const error = makePostgrestError({
      message: "duplicate key value violates unique constraint",
      code: "23505",
    });
    expect(isForeignKeyViolationError(error)).toBe(false);
  });

  it("returns false for RLS violations (42501)", () => {
    const error = makePostgrestError({
      message: "new row violates row-level security policy",
      code: "42501",
    });
    expect(isForeignKeyViolationError(error)).toBe(false);
  });

  it("returns false for generic errors without code", () => {
    const error = new Error("Something went wrong");
    expect(isForeignKeyViolationError(error)).toBe(false);
  });

  it("returns false for generic Error with non-23503 code property", () => {
    const error = Object.assign(
      new Error("duplicate key"),
      { code: "23505" },
    );
    expect(isForeignKeyViolationError(error)).toBe(false);
  });

  it("detects FK violation by message when error lacks code property (MEMO-2F fallback)", () => {
    const error = new Error(
      'insert or update on table "page_versions" violates foreign key constraint "page_versions_page_id_fkey"',
    );
    expect(isForeignKeyViolationError(error)).toBe(true);
  });

  it("returns false for message without FK violation pattern and no code", () => {
    const error = new Error("some other database error");
    expect(isForeignKeyViolationError(error)).toBe(false);
  });
});

describe("isDuplicateKeyError", () => {
  it("detects PostgreSQL 23505 (unique_violation) from PostgrestError", () => {
    const error = makePostgrestError({
      message: 'duplicate key value violates unique constraint "database_properties_db_name"',
      code: "23505",
    });
    expect(isDuplicateKeyError(error)).toBe(true);
  });

  it("detects 23505 from generic Error with code property (thrown path)", () => {
    const error = Object.assign(
      new Error('duplicate key value violates unique constraint "database_properties_db_name"'),
      { code: "23505" },
    );
    expect(isDuplicateKeyError(error)).toBe(true);
  });

  it("returns false for other PostgrestError codes", () => {
    const error = makePostgrestError({
      message: "foreign key violation",
      code: "23503",
    });
    expect(isDuplicateKeyError(error)).toBe(false);
  });

  it("returns false for RLS violations (42501)", () => {
    const error = makePostgrestError({
      message: "new row violates row-level security policy",
      code: "42501",
    });
    expect(isDuplicateKeyError(error)).toBe(false);
  });

  it("returns false for generic errors without code", () => {
    const error = new Error("Something went wrong");
    expect(isDuplicateKeyError(error)).toBe(false);
  });

  it("returns false for generic Error with non-23505 code property", () => {
    const error = Object.assign(
      new Error("foreign key violation"),
      { code: "23503" },
    );
    expect(isDuplicateKeyError(error)).toBe(false);
  });
});

describe("isStatementTimeoutError", () => {
  it("detects PostgreSQL 57014 (statement_timeout) from PostgrestError", () => {
    const error = makePostgrestError({
      message: "canceling statement due to statement timeout",
      code: "57014",
    });
    expect(isStatementTimeoutError(error)).toBe(true);
  });

  it("detects 57014 from generic Error with code property (thrown path)", () => {
    const error = Object.assign(
      new Error("canceling statement due to statement timeout"),
      { code: "57014" },
    );
    expect(isStatementTimeoutError(error)).toBe(true);
  });

  it("returns false for other PostgrestError codes", () => {
    const error = makePostgrestError({
      message: "some error",
      code: "42501",
    });
    expect(isStatementTimeoutError(error)).toBe(false);
  });

  it("returns false for generic errors without code", () => {
    const error = new Error("canceling statement due to statement timeout");
    expect(isStatementTimeoutError(error)).toBe(false);
  });

  it("returns false for generic Error with non-57014 code property", () => {
    const error = Object.assign(
      new Error("some error"),
      { code: "23505" },
    );
    expect(isStatementTimeoutError(error)).toBe(false);
  });
});

describe("isEmptyResultError", () => {
  it("detects PGRST116 empty result from .single() (MEMO-1P)", () => {
    const error = makePostgrestError({
      message: "Cannot coerce the result to a single JSON object",
      code: "PGRST116",
      details: "The result contains 0 rows",
    });
    expect(isEmptyResultError(error)).toBe(true);
  });

  it("returns false for other PostgREST errors", () => {
    const error = makePostgrestError({
      message: "some error",
      code: "PGRST205",
    });
    expect(isEmptyResultError(error)).toBe(false);
  });

  it("returns false for generic errors with code property", () => {
    const error = Object.assign(
      new Error("some error"),
      { code: "PGRST116" },
    );
    expect(isEmptyResultError(error)).toBe(false);
  });

  it("returns false for plain errors", () => {
    const error = new Error("Cannot coerce the result to a single JSON object");
    expect(isEmptyResultError(error)).toBe(false);
  });
});

describe("isPostgrestServerError", () => {
  it("detects PGRST500 PostgREST internal server error (MEMO-22)", () => {
    const error = makePostgrestError({
      message: "simulated property creation error",
      code: "PGRST500",
    });
    expect(isPostgrestServerError(error)).toBe(true);
  });

  it("returns false for other PostgREST errors", () => {
    const error = makePostgrestError({
      message: "some error",
      code: "PGRST205",
    });
    expect(isPostgrestServerError(error)).toBe(false);
  });

  it("returns false for plain errors", () => {
    const error = new Error("PGRST500");
    expect(isPostgrestServerError(error)).toBe(false);
  });
});

describe("isTransientStorageError", () => {
  it("detects StorageApiError database timeout (MEMO-1N)", () => {
    const error = new Error("The connection to the database timed out");
    error.name = "StorageApiError";
    expect(isTransientStorageError(error)).toBe(true);
  });

  it("detects connection terminated due to connection timeout", () => {
    const error = new Error("connection terminated due to connection timeout");
    error.name = "StorageApiError";
    expect(isTransientStorageError(error)).toBe(true);
  });

  it("detects timeout message regardless of error name", () => {
    const error = new Error("The connection to the database timed out");
    expect(isTransientStorageError(error)).toBe(true);
  });

  it("returns false for transient network errors", () => {
    const error = new Error("Failed to fetch");
    expect(isTransientStorageError(error)).toBe(false);
  });

  it("returns false for generic application errors", () => {
    const error = new Error("Something went wrong");
    expect(isTransientStorageError(error)).toBe(false);
  });

  it("returns false for PostgrestError timeouts (handled by isStatementTimeoutError)", () => {
    const error = makePostgrestError({
      message: "canceling statement due to statement timeout",
      code: "57014",
    });
    expect(isTransientStorageError(error)).toBe(false);
  });
});

describe("isSupabaseAuthLockError", () => {
  it("detects AbortError in PostgrestError details (MEMO-16/17/19)", () => {
    const error = makePostgrestError({
      message: "AbortError: Lock broken by another request with the 'steal' option.",
      code: "",
      details: "AbortError: Lock broken by another request with the 'steal' option.",
      hint: "Request was aborted (timeout or manual cancellation)",
    });
    expect(isSupabaseAuthLockError(error)).toBe(true);
  });

  it("detects lock-released message from Supabase auth internals (MEMO-18)", () => {
    const error = new Error(
      'Lock "lock:sb-yoipusltrtbvneuywzkj-auth-token" was released because another request stole it',
    );
    expect(isSupabaseAuthLockError(error)).toBe(true);
  });

  it("detects lock-broken message in plain Error", () => {
    const error = new Error(
      "AbortError: Lock broken by another request with the 'steal' option.",
    );
    expect(isSupabaseAuthLockError(error)).toBe(true);
  });

  it("returns false for transient network errors", () => {
    const error = new Error("Failed to fetch");
    expect(isSupabaseAuthLockError(error)).toBe(false);
  });

  it("returns false for generic application errors", () => {
    const error = new Error("Something went wrong");
    expect(isSupabaseAuthLockError(error)).toBe(false);
  });

  it("returns false for RLS violations", () => {
    const error = makePostgrestError({
      message: "new row violates row-level security policy",
      code: "42501",
    });
    expect(isSupabaseAuthLockError(error)).toBe(false);
  });

  // --- Null details regression test (MEMO-2E / #944) ---

  it("does not crash when PostgREST error has details: null (#944 MEMO-2E)", () => {
    const error = { message: "server error", code: "XX000", details: null, hint: null };
    expect(() => isSupabaseAuthLockError(error as unknown as Error)).not.toThrow();
    expect(isSupabaseAuthLockError(error as unknown as Error)).toBe(false);
  });
});

describe("captureSupabaseError", () => {
  beforeEach(() => {
    captureExceptionMock.mockClear();
  });

  // captureSupabaseError uses lazyCaptureException which calls
  // import("@sentry/nextjs").then(...). Flushing microtasks lets the
  // mocked dynamic import resolve before assertions run.
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it("captures transient network errors at warning level", async () => {
    const error = new Error("Failed to fetch");
    captureSupabaseError(error, "page-tree:workspace-lookup");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.level).toBe("warning");
    expect(opts.extra.operation).toBe("page-tree:workspace-lookup");
  });

  it("captures PostgrestError with network details at warning level", async () => {
    const error = makePostgrestError({
      message: "request failed",
      details: "TypeError: Failed to fetch",
    });
    captureSupabaseError(error, "page-tree:fetch-pages");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.level).toBe("warning");
  });

  it("captures PGRST205 schema-not-found errors at warning level", async () => {
    const error = makePostgrestError({
      message: "Could not find the table 'public.favorites' in the schema cache",
      code: "PGRST205",
      hint: "Perhaps you meant the table 'public.profiles'",
    });
    captureSupabaseError(error, "page-tree:fetch-favorites");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.level).toBe("warning");
    expect(opts.extra.operation).toBe("page-tree:fetch-favorites");
    expect(opts.extra.code).toBe("PGRST205");
  });

  it("captures RLS violations (42501) at warning level (MEMO-E)", async () => {
    const error = makePostgrestError({
      message: "new row violates row-level security policy for table \"pages\"",
      code: "42501",
    });
    captureSupabaseError(error, "page-tree:create-page");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.level).toBe("warning");
    expect(opts.extra.operation).toBe("page-tree:create-page");
    expect(opts.extra.code).toBe("42501");
  });

  it("captures foreign key violations (23503) at warning level (MEMO-1B)", async () => {
    const error = makePostgrestError({
      message: 'insert or update on table "pages" violates foreign key constraint "pages_workspace_id_fkey"',
      code: "23503",
    });
    captureSupabaseError(error, "page-tree:create-page");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.level).toBe("warning");
    expect(opts.extra.operation).toBe("page-tree:create-page");
    expect(opts.extra.code).toBe("23503");
  });

  it("captures Node.js native fetch errors at warning level (MEMO-15)", async () => {
    const cause = new Error(
      "Client network socket disconnected before secure TLS connection was established (ECONNRESET)",
    );
    const error = new Error("fetch failed", { cause });
    captureSupabaseError(error, "usage-events:track");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.level).toBe("warning");
    expect(opts.extra.operation).toBe("usage-events:track");
  });

  it("captures Supabase auth lock errors at warning level (MEMO-16/17/19)", async () => {
    const error = makePostgrestError({
      message: "AbortError: Lock broken by another request with the 'steal' option.",
      code: "",
      details: "AbortError: Lock broken by another request with the 'steal' option.",
      hint: "Request was aborted (timeout or manual cancellation)",
    });
    captureSupabaseError(error, "favorites:check");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.level).toBe("warning");
    expect(opts.extra.operation).toBe("favorites:check");
  });

  it("captures hostname-suffixed transient network errors at warning level (MEMO-1A)", async () => {
    const error = makePostgrestError({
      message: "TypeError: Failed to fetch (yoipusltrtbvneuywzkj.supabase.co)",
      details:
        "TypeError: Failed to fetch\n    at https://memo.software-factory.dev/_next/static/chunks/0vbg59c79mvs4.js:20:1653",
    });
    captureSupabaseError(error, "create-workspace-dialog:create");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.level).toBe("warning");
    expect(opts.extra.operation).toBe("create-workspace-dialog:create");
  });

  it("captures duplicate key violations (23505) at warning level (MEMO-1G)", async () => {
    const error = makePostgrestError({
      message: "duplicate key value violates unique constraint",
      code: "23505",
    });
    captureSupabaseError(error, "database.addProperty");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.level).toBe("warning");
    expect(opts.extra.operation).toBe("database.addProperty");
    expect(opts.extra.code).toBe("23505");
  });

  it("captures statement timeout (57014) at warning level (MEMO-1J)", async () => {
    const error = makePostgrestError({
      message: "canceling statement due to statement timeout",
      code: "57014",
    });
    captureSupabaseError(error, "delete_account");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.level).toBe("warning");
    expect(opts.extra.operation).toBe("delete_account");
    expect(opts.extra.code).toBe("57014");
  });

  it("captures PGRST116 empty result at warning level (MEMO-1P)", async () => {
    const error = makePostgrestError({
      message: "Cannot coerce the result to a single JSON object",
      code: "PGRST116",
      details: "The result contains 0 rows",
    });
    captureSupabaseError(error, "database.addRow:lookup");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.level).toBe("warning");
    expect(opts.extra.operation).toBe("database.addRow:lookup");
    expect(opts.extra.code).toBe("PGRST116");
  });

  it("captures StorageApiError database timeout at warning level (MEMO-1N)", async () => {
    const error = new Error("The connection to the database timed out");
    error.name = "StorageApiError";
    captureSupabaseError(error, "image-plugin:upload");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.level).toBe("warning");
    expect(opts.extra.operation).toBe("image-plugin:upload");
  });

  it("captures PGRST500 at error level with code in extra (MEMO-22)", async () => {
    const error = makePostgrestError({
      message: "simulated property creation error",
      code: "PGRST500",
    });
    captureSupabaseError(error, "database.addProperty");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.level).toBeUndefined();
    expect(opts.extra.operation).toBe("database.addProperty");
    expect(opts.extra.code).toBe("PGRST500");
  });

  it("includes PostgrestError fields in extra", async () => {
    const error = makePostgrestError({
      message: "duplicate key",
      code: "23505",
      details: "Key (id)=(abc) already exists.",
      hint: "",
    });
    captureSupabaseError(error, "pages.insert");
    await flush();

    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.extra.code).toBe("23505");
    expect(opts.extra.details).toBe("Key (id)=(abc) already exists.");
  });

  // --- Plain object regression tests (MEMO-E / MEMO-C / #828) ---
  // The Supabase PostgREST client returns plain objects (not PostgrestError
  // instances) when fetch throws a network error in the default mode.

  it("wraps plain Supabase error objects in Error before sending to Sentry (#828 MEMO-E)", async () => {
    const plainError = makePlainSupabaseError({
      message: "TypeError: Failed to fetch (yoipusltrtbvneuywzkj.supabase.co)",
      details:
        "TypeError: Failed to fetch\n    at https://memo.software-factory.dev/_next/static/chunks/0vf8__som4qot.js:20:1653",
    });
    captureSupabaseError(plainError as unknown as Error, "editor:save");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [captured, opts] = captureExceptionMock.mock.calls[0];
    // Must be a proper Error instance, not a plain object
    expect(captured).toBeInstanceOf(Error);
    expect(captured.name).toBe("SupabaseError");
    expect(captured.message).toBe(
      "TypeError: Failed to fetch (yoipusltrtbvneuywzkj.supabase.co)",
    );
    // Transient network error → warning level
    expect(opts.level).toBe("warning");
    expect(opts.extra.operation).toBe("editor:save");
  });

  it("extracts code/details/hint from plain Supabase error objects (#828 MEMO-C)", async () => {
    const plainError = makePlainSupabaseError({
      message: "TypeError: Failed to fetch (yoipusltrtbvneuywzkj.supabase.co)",
      details:
        "TypeError: Failed to fetch\n    at http://localhost:3000/_next/static/chunks/0.rz_@sentry_core.js:6673:34",
      code: "",
      hint: "",
    });
    captureSupabaseError(plainError as unknown as Error, "database-properties:reorder");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [captured, opts] = captureExceptionMock.mock.calls[0];
    expect(captured).toBeInstanceOf(Error);
    expect(opts.level).toBe("warning");
    expect(opts.extra.code).toBe("");
    expect(opts.extra.details).toContain("TypeError: Failed to fetch");
    expect(opts.extra.operation).toBe("database-properties:reorder");
  });

  it("passes Error instances through without wrapping", async () => {
    const error = new Error("Failed to fetch");
    captureSupabaseError(error, "page-tree:fetch-pages");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [captured] = captureExceptionMock.mock.calls[0];
    // Should be the original Error, not wrapped
    expect(captured).toBe(error);
  });

  it("wraps plain non-network Supabase errors in Error at error level (#828)", async () => {
    const plainError = makePlainSupabaseError({
      message: "unexpected server error",
      code: "PGRST500",
      details: "internal error",
    });
    captureSupabaseError(plainError as unknown as Error, "database.addProperty");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [captured, opts] = captureExceptionMock.mock.calls[0];
    expect(captured).toBeInstanceOf(Error);
    expect(captured.name).toBe("SupabaseError");
    // Non-transient → error level (no level override)
    expect(opts.level).toBeUndefined();
    expect(opts.extra.code).toBe("PGRST500");
  });

  // --- Null details/hint regression test (MEMO-2E / #944) ---

  it("does not crash when PostgREST error has details: null and hint: null (#944 MEMO-2E)", async () => {
    const error = { message: "server error", code: "XX000", details: null, hint: null };
    expect(() => captureSupabaseError(error as unknown as Error, "page-tree:fetch-pages")).not.toThrow();
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.extra.details).toBe("");
    expect(opts.extra.hint).toBe("");
    expect(opts.extra.code).toBe("XX000");
  });

  it("includes userAgent in extra when provided (MEMO-2F E2E detection)", async () => {
    const error = new Error("some error");
    captureSupabaseError(error, "page-versions:create", "Mozilla/5.0 HeadlessChrome/147.0.0.0");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.extra.userAgent).toBe("Mozilla/5.0 HeadlessChrome/147.0.0.0");
    expect(opts.extra.operation).toBe("page-versions:create");
  });

  it("omits userAgent from extra when not provided", async () => {
    const error = new Error("some error");
    captureSupabaseError(error, "page-versions:create");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.extra.userAgent).toBeUndefined();
  });
});

function makeSentryEvent(
  exceptionValues: Array<{ value?: string; type?: string }>,
): ErrorEvent {
  return {
    type: undefined,
    exception: { values: exceptionValues },
  } as ErrorEvent;
}

describe("isNextjsInternalNoise", () => {
  it("detects router state header parse error", () => {
    const event = makeSentryEvent([
      {
        type: "Error",
        value: "The router state header was sent but could not be parsed.",
      },
    ]);
    expect(isNextjsInternalNoise(event)).toBe(true);
  });

  it("detects the error when it appears as a substring", () => {
    const event = makeSentryEvent([
      {
        type: "Error",
        value:
          "Error: The router state header was sent but could not be parsed. Value: corrupted",
      },
    ]);
    expect(isNextjsInternalNoise(event)).toBe(true);
  });

  it("detects the error in any exception value (chained exceptions)", () => {
    const event = makeSentryEvent([
      { type: "Error", value: "Some wrapper error" },
      {
        type: "Error",
        value: "The router state header was sent but could not be parsed.",
      },
    ]);
    expect(isNextjsInternalNoise(event)).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    const event = makeSentryEvent([
      { type: "TypeError", value: "Cannot read properties of undefined" },
    ]);
    expect(isNextjsInternalNoise(event)).toBe(false);
  });

  it("returns false when exception values are empty", () => {
    const event = makeSentryEvent([]);
    expect(isNextjsInternalNoise(event)).toBe(false);
  });

  it("returns false when exception is missing", () => {
    const event = { type: undefined } as ErrorEvent;
    expect(isNextjsInternalNoise(event)).toBe(false);
  });

  it("returns false when exception value is undefined", () => {
    const event = makeSentryEvent([{ type: "Error" }]);
    expect(isNextjsInternalNoise(event)).toBe(false);
  });
});

/**
 * Helper that builds a Sentry ErrorEvent with stacktrace support.
 * Extends the simpler `makeSentryEvent` for tests that need frame data.
 */
function makeSentryEventWithStack(
  exceptionValues: Array<{
    value?: string;
    type?: string;
    stacktrace?: {
      frames?: Array<{ filename?: string; abs_path?: string }>;
    };
  }>,
): ErrorEvent {
  return {
    type: undefined,
    exception: { values: exceptionValues },
  } as ErrorEvent;
}

describe("isReactLexicalDomConflict", () => {
  it("detects NotFoundError with removeChild and no first-party frames", () => {
    const event = makeSentryEventWithStack([
      {
        type: "NotFoundError",
        value:
          "Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.",
        stacktrace: {
          frames: [
            { filename: "https://example.com/_next/static/chunks/1431zjw_sha2v.js" },
            { filename: "https://example.com/_next/static/chunks/1431zjw_sha2v.js" },
          ],
        },
      },
    ]);
    expect(isReactLexicalDomConflict(event)).toBe(true);
  });

  it("detects the error with empty frames (fully minified stack)", () => {
    const event = makeSentryEventWithStack([
      {
        type: "NotFoundError",
        value:
          "Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.",
        stacktrace: { frames: [] },
      },
    ]);
    expect(isReactLexicalDomConflict(event)).toBe(true);
  });

  it("detects the error with no stacktrace at all", () => {
    const event = makeSentryEventWithStack([
      {
        type: "NotFoundError",
        value:
          "Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.",
      },
    ]);
    expect(isReactLexicalDomConflict(event)).toBe(true);
  });

  it("returns false when first-party frames are present (src/)", () => {
    const event = makeSentryEventWithStack([
      {
        type: "NotFoundError",
        value:
          "Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.",
        stacktrace: {
          frames: [
            { filename: "https://example.com/_next/static/chunks/1431zjw_sha2v.js" },
            { filename: "app:///src/components/editor/editor.tsx" },
          ],
        },
      },
    ]);
    expect(isReactLexicalDomConflict(event)).toBe(false);
  });

  it("detects the error with app:// third-party chunk frames (MEMO-11)", () => {
    const event = makeSentryEventWithStack([
      {
        type: "NotFoundError",
        value:
          "Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.",
        stacktrace: {
          frames: [
            { abs_path: "app:///_next/static/chunks/main.js" },
            { filename: "app:///_next/static/chunks/01jr_next_dist_compiled_react-dom_08~fs09._.js" },
          ],
        },
      },
    ]);
    expect(isReactLexicalDomConflict(event)).toBe(true);
  });

  it("returns false when first-party frames use app:// with /src/ path", () => {
    const event = makeSentryEventWithStack([
      {
        type: "NotFoundError",
        value:
          "Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.",
        stacktrace: {
          frames: [
            { abs_path: "app:///_next/static/chunks/main.js" },
            { filename: "app:///src/components/editor/editor.tsx" },
          ],
        },
      },
    ]);
    expect(isReactLexicalDomConflict(event)).toBe(false);
  });

  it("returns false when first-party frames use webpack-internal:// scheme", () => {
    const event = makeSentryEventWithStack([
      {
        type: "NotFoundError",
        value:
          "Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.",
        stacktrace: {
          frames: [
            { filename: "webpack-internal:///src/components/editor/editor.tsx" },
          ],
        },
      },
    ]);
    expect(isReactLexicalDomConflict(event)).toBe(false);
  });

  it("returns false for NotFoundError without removeChild", () => {
    const event = makeSentryEventWithStack([
      {
        type: "NotFoundError",
        value: "The object can not be found here.",
      },
    ]);
    expect(isReactLexicalDomConflict(event)).toBe(false);
  });

  it("returns false for removeChild error with a different error type", () => {
    const event = makeSentryEventWithStack([
      {
        type: "DOMException",
        value:
          "Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.",
      },
    ]);
    expect(isReactLexicalDomConflict(event)).toBe(false);
  });

  it("returns false for unrelated errors", () => {
    const event = makeSentryEvent([
      { type: "TypeError", value: "Cannot read properties of undefined" },
    ]);
    expect(isReactLexicalDomConflict(event)).toBe(false);
  });

  it("returns false when exception values are empty", () => {
    const event = makeSentryEvent([]);
    expect(isReactLexicalDomConflict(event)).toBe(false);
  });

  it("returns false when exception is missing", () => {
    const event = { type: undefined } as ErrorEvent;
    expect(isReactLexicalDomConflict(event)).toBe(false);
  });

  it("detects the error in chained exceptions", () => {
    const event = makeSentryEventWithStack([
      { type: "Error", value: "Some wrapper error" },
      {
        type: "NotFoundError",
        value:
          "Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.",
        stacktrace: {
          frames: [
            { filename: "https://example.com/_next/static/chunks/framework.js" },
          ],
        },
      },
    ]);
    expect(isReactLexicalDomConflict(event)).toBe(true);
  });
});

describe("isSupabaseAuthLockContention", () => {
  it("detects lock-released unhandled rejection (MEMO-18)", () => {
    const event = makeSentryEvent([
      {
        type: "Error",
        value:
          'Lock "lock:sb-yoipusltrtbvneuywzkj-auth-token" was released because another request stole it',
      },
    ]);
    expect(isSupabaseAuthLockContention(event)).toBe(true);
  });

  it("detects lock-broken AbortError in event value", () => {
    const event = makeSentryEvent([
      {
        type: "Error",
        value:
          "AbortError: Lock broken by another request with the 'steal' option.",
      },
    ]);
    expect(isSupabaseAuthLockContention(event)).toBe(true);
  });

  it("detects the error in chained exceptions", () => {
    const event = makeSentryEvent([
      { type: "Error", value: "Some wrapper error" },
      {
        type: "Error",
        value:
          'Lock "lock:sb-abc123-auth-token" was released because another request stole it',
      },
    ]);
    expect(isSupabaseAuthLockContention(event)).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    const event = makeSentryEvent([
      { type: "TypeError", value: "Cannot read properties of undefined" },
    ]);
    expect(isSupabaseAuthLockContention(event)).toBe(false);
  });

  it("returns false when exception values are empty", () => {
    const event = makeSentryEvent([]);
    expect(isSupabaseAuthLockContention(event)).toBe(false);
  });

  it("returns false when exception is missing", () => {
    const event = { type: undefined } as ErrorEvent;
    expect(isSupabaseAuthLockContention(event)).toBe(false);
  });
});

describe("isTransientSupabaseNetworkEvent", () => {
  it("detects 'Failed to fetch' in exception value (#828 MEMO-E)", () => {
    const event = makeSentryEvent([
      {
        type: "SupabaseError",
        value: "TypeError: Failed to fetch (yoipusltrtbvneuywzkj.supabase.co)",
      },
    ]);
    expect(isTransientSupabaseNetworkEvent(event)).toBe(true);
  });

  it("detects 'fetch failed' in exception value (Node.js)", () => {
    const event = makeSentryEvent([
      { type: "Error", value: "TypeError: fetch failed" },
    ]);
    expect(isTransientSupabaseNetworkEvent(event)).toBe(true);
  });

  it("detects 'Load failed' (Safari) in exception value", () => {
    const event = makeSentryEvent([
      { type: "Error", value: "Load failed" },
    ]);
    expect(isTransientSupabaseNetworkEvent(event)).toBe(true);
  });

  it("detects 'NetworkError when attempting to fetch resource' (Firefox)", () => {
    const event = makeSentryEvent([
      {
        type: "Error",
        value: "NetworkError when attempting to fetch resource.",
      },
    ]);
    expect(isTransientSupabaseNetworkEvent(event)).toBe(true);
  });

  it("detects 'The Internet connection appears to be offline'", () => {
    const event = makeSentryEvent([
      {
        type: "Error",
        value: "The Internet connection appears to be offline.",
      },
    ]);
    expect(isTransientSupabaseNetworkEvent(event)).toBe(true);
  });

  it("detects 'Network request failed'", () => {
    const event = makeSentryEvent([
      { type: "Error", value: "Network request failed" },
    ]);
    expect(isTransientSupabaseNetworkEvent(event)).toBe(true);
  });

  it("detects plain-object Sentry error with transient network message in extra (#828)", () => {
    const event = {
      type: undefined,
      exception: {
        values: [
          {
            type: "Error",
            value:
              "Object captured as exception with keys: code, details, hint, message",
          },
        ],
      },
      extra: {
        message: "TypeError: Failed to fetch (yoipusltrtbvneuywzkj.supabase.co)",
        operation: "editor:save",
      },
    } as unknown as ErrorEvent;
    expect(isTransientSupabaseNetworkEvent(event)).toBe(true);
  });

  it("detects plain-object Sentry error with __serialized__ extra (#828)", () => {
    const event = {
      type: undefined,
      exception: {
        values: [
          {
            type: "Error",
            value:
              "Object captured as exception with keys: code, details, hint, message",
          },
        ],
      },
      extra: {
        __serialized__: {
          message: "TypeError: Failed to fetch (yoipusltrtbvneuywzkj.supabase.co)",
          code: "",
          details: "TypeError: Failed to fetch",
          hint: "",
        },
      },
    } as unknown as ErrorEvent;
    expect(isTransientSupabaseNetworkEvent(event)).toBe(true);
  });

  it("returns false for non-network errors", () => {
    const event = makeSentryEvent([
      { type: "Error", value: "Cannot read properties of undefined" },
    ]);
    expect(isTransientSupabaseNetworkEvent(event)).toBe(false);
  });

  it("returns false for plain-object error without transient network message", () => {
    const event = {
      type: undefined,
      exception: {
        values: [
          {
            type: "Error",
            value:
              "Object captured as exception with keys: code, details, hint, message",
          },
        ],
      },
      extra: {
        message: "new row violates row-level security policy",
        operation: "page-tree:create-page",
      },
    } as unknown as ErrorEvent;
    expect(isTransientSupabaseNetworkEvent(event)).toBe(false);
  });

  it("returns false when exception values are empty", () => {
    const event = makeSentryEvent([]);
    expect(isTransientSupabaseNetworkEvent(event)).toBe(false);
  });

  it("returns false when exception is missing", () => {
    const event = { type: undefined } as ErrorEvent;
    expect(isTransientSupabaseNetworkEvent(event)).toBe(false);
  });

  it("detects transient error in chained exceptions", () => {
    const event = makeSentryEvent([
      { type: "Error", value: "Some wrapper error" },
      { type: "TypeError", value: "Failed to fetch" },
    ]);
    expect(isTransientSupabaseNetworkEvent(event)).toBe(true);
  });
});

describe("captureApiError", () => {
  beforeEach(() => {
    captureExceptionMock.mockClear();
  });

  const flush = () => new Promise((r) => setTimeout(r, 0));

  it("captures transient network errors at warning level", async () => {
    const error = new Error("TypeError: Failed to fetch");
    captureApiError(error, "versions:fetch");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.level).toBe("warning");
    expect(opts.extra.operation).toBe("versions:fetch");
    expect(opts.extra.message).toBe("TypeError: Failed to fetch");
  });

  it("captures 'Failed to fetch' at warning level", async () => {
    const error = new Error("Failed to fetch");
    captureApiError(error, "versions:select");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.level).toBe("warning");
    expect(opts.extra.operation).toBe("versions:select");
  });

  it("captures 'Load failed' (Safari) at warning level", async () => {
    const error = new Error("Load failed");
    captureApiError(error, "versions:restore");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.level).toBe("warning");
    expect(opts.extra.operation).toBe("versions:restore");
  });

  it("captures non-transient errors at error level (default)", async () => {
    const error = new Error("Failed to restore version: 500");
    captureApiError(error, "versions:restore");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.level).toBeUndefined();
    expect(opts.extra.operation).toBe("versions:restore");
    expect(opts.extra.message).toBe("Failed to restore version: 500");
  });

  it("captures non-Error values at error level", async () => {
    captureApiError("string error", "versions:fetch");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [err, opts] = captureExceptionMock.mock.calls[0];
    expect(err).toBe("string error");
    expect(opts.level).toBeUndefined();
    expect(opts.extra.operation).toBe("versions:fetch");
  });

  it("includes operation in extra for all captures", async () => {
    const error = new Error("some error");
    captureApiError(error, "versions:select");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.extra.operation).toBe("versions:select");
  });

  it("includes userAgent in extra when provided (MEMO-2F E2E detection)", async () => {
    const error = new Error("some error");
    captureApiError(error, "page-versions:create", "Mozilla/5.0 HeadlessChrome/147.0.0.0");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.extra.userAgent).toBe("Mozilla/5.0 HeadlessChrome/147.0.0.0");
    expect(opts.extra.operation).toBe("page-versions:create");
  });

  it("omits userAgent from extra when not provided", async () => {
    const error = new Error("some error");
    captureApiError(error, "page-versions:create");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.extra.userAgent).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// isE2ETestSession — prevents simulated E2E errors from reaching Sentry
// ---------------------------------------------------------------------------

describe("isE2ETestSession", () => {
  const win = window as unknown as Record<string, unknown>;

  afterEach(() => {
    delete win.__SENTRY_DISABLED__;
  });

  it("returns true when __SENTRY_DISABLED__ is set on window", () => {
    win.__SENTRY_DISABLED__ = true;
    expect(isE2ETestSession()).toBe(true);
  });

  it("returns false when __SENTRY_DISABLED__ is not set", () => {
    delete win.__SENTRY_DISABLED__;
    expect(isE2ETestSession()).toBe(false);
  });

  it("returns false when __SENTRY_DISABLED__ is a non-true value", () => {
    win.__SENTRY_DISABLED__ = "true";
    expect(isE2ETestSession()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isE2ETestRequest — drops server-side Sentry events from E2E test sessions
// ---------------------------------------------------------------------------

describe("isE2ETestRequest", () => {
  function makeRequestEvent(headers: Record<string, string>): ErrorEvent {
    return { type: undefined, request: { headers } } as unknown as ErrorEvent;
  }

  it("returns true when User-Agent contains HeadlessChrome/", () => {
    const event = makeRequestEvent({
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/147.0.0.0 Safari/537.36",
    });
    expect(isE2ETestRequest(event)).toBe(true);
  });

  it("returns true when user-agent header is lowercase", () => {
    const event = makeRequestEvent({
      "user-agent":
        "Mozilla/5.0 HeadlessChrome/147.0.0.0 Safari/537.36",
    });
    expect(isE2ETestRequest(event)).toBe(true);
  });

  it("returns false for a normal Chrome user-agent", () => {
    const event = makeRequestEvent({
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/147.0.0.0 Safari/537.36",
    });
    expect(isE2ETestRequest(event)).toBe(false);
  });

  it("returns true when request has no headers but browser context is HeadlessChrome", () => {
    const event = {
      type: undefined,
      request: {},
      contexts: { browser: { name: "HeadlessChrome", version: "147.0.0" } },
    } as unknown as ErrorEvent;
    expect(isE2ETestRequest(event)).toBe(true);
  });

  it("returns true when event has no request but browser context is HeadlessChrome", () => {
    const event = {
      type: undefined,
      contexts: { browser: { name: "HeadlessChrome", version: "147.0.0" } },
    } as unknown as ErrorEvent;
    expect(isE2ETestRequest(event)).toBe(true);
  });

  it("returns false when browser context is regular Chrome", () => {
    const event = {
      type: undefined,
      request: {},
      contexts: { browser: { name: "Chrome", version: "147.0.0" } },
    } as unknown as ErrorEvent;
    expect(isE2ETestRequest(event)).toBe(false);
  });

  it("returns false when request has no headers and no browser context", () => {
    const event = { type: undefined, request: {} } as unknown as ErrorEvent;
    expect(isE2ETestRequest(event)).toBe(false);
  });

  it("returns false when event has no request and no contexts", () => {
    const event = { type: undefined } as ErrorEvent;
    expect(isE2ETestRequest(event)).toBe(false);
  });

  it("returns false when browser context name is not a string", () => {
    const event = {
      type: undefined,
      contexts: { browser: { name: 42 } },
    } as unknown as ErrorEvent;
    expect(isE2ETestRequest(event)).toBe(false);
  });

  it("returns true when extra.userAgent contains HeadlessChrome/ (MEMO-2F server-side fallback)", () => {
    const event = {
      type: undefined,
      extra: { userAgent: "Mozilla/5.0 HeadlessChrome/147.0.0.0 Safari/537.36" },
    } as unknown as ErrorEvent;
    expect(isE2ETestRequest(event)).toBe(true);
  });

  it("returns false when extra.userAgent is a normal Chrome UA", () => {
    const event = {
      type: undefined,
      extra: { userAgent: "Mozilla/5.0 Chrome/147.0.0.0 Safari/537.36" },
    } as unknown as ErrorEvent;
    expect(isE2ETestRequest(event)).toBe(false);
  });

  it("returns false when extra.userAgent is not a string", () => {
    const event = {
      type: undefined,
      extra: { userAgent: 42 },
    } as unknown as ErrorEvent;
    expect(isE2ETestRequest(event)).toBe(false);
  });

  it("returns false when extra exists but has no userAgent", () => {
    const event = {
      type: undefined,
      extra: { operation: "page-versions:create" },
    } as unknown as ErrorEvent;
    expect(isE2ETestRequest(event)).toBe(false);
  });
});
