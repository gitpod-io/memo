/**
 * Integration-style tests for Sentry error classification edge cases.
 *
 * Each test uses realistic error shapes from production Sentry events
 * referenced in closed bug issues. The goal is to exercise the classification
 * pipeline end-to-end with the exact error shapes that caused noise-related
 * bug reports, reducing regressions.
 *
 * Reference issues: #944, #933, #931, #1114, #1013, #1240, #1083, #1084, #856
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";
import { PostgrestError } from "@supabase/supabase-js";

const captureExceptionMock = vi.fn();

let mockScopeData: Record<string, unknown> = {};

vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => captureExceptionMock(...args),
  getIsolationScope: () => ({
    getScopeData: () => mockScopeData,
  }),
}));

import {
  isTransientNetworkError,
  isSupabaseAuthLockError,
  isForeignKeyViolationError,
  isStatementTimeoutError,
  isPostgrestError,
  captureSupabaseError,
  captureApiError,
  isE2ETestRequest,
} from ".";

// --- Helpers ---

/** Flush microtasks so lazyCaptureException's dynamic import resolves. */
const flush = () => new Promise((r) => setTimeout(r, 0));

/**
 * Create a plain object matching the PostgREST error shape with null fields.
 * PostgREST 500 responses return `{ message, code, details: null, hint: null }`.
 * The Supabase client sometimes returns these as plain objects (not PostgrestError
 * instances) from the `executeWithRetry` catch handler.
 */
function makePlainPostgrestWithNulls(
  overrides: { message?: string; code?: string; details?: null; hint?: null } = {},
): { message: string; code: string; details: null; hint: null } {
  return {
    message: overrides.message ?? "server error",
    code: overrides.code ?? "XX000",
    details: null,
    hint: null,
  };
}

// =============================================================================
// PostgREST errors with null details field (regression from #944)
// =============================================================================

describe("PostgREST errors with null details (regression #944)", () => {
  it("isTransientNetworkError does not crash on PostgrestError with details: null", () => {
    // Realistic shape: PostgREST HTTP 500 with null details
    // Sentry MEMO-2E: TypeError: Cannot read properties of null (reading 'startsWith')
    const error = new PostgrestError({
      message: "TypeError: fetch failed",
      details: null as unknown as string,
      hint: null as unknown as string,
      code: "XX000",
    });
    // Should not throw — the null coalescing fix from #944 prevents the crash
    expect(() => isTransientNetworkError(error)).not.toThrow();
    // The message matches a transient pattern, so it should return true
    expect(isTransientNetworkError(error)).toBe(true);
  });

  it("isTransientNetworkError returns false for non-transient error with null details", () => {
    const error = new PostgrestError({
      message: "relation \"pages\" does not exist",
      details: null as unknown as string,
      hint: null as unknown as string,
      code: "42P01",
    });
    expect(() => isTransientNetworkError(error)).not.toThrow();
    expect(isTransientNetworkError(error)).toBe(false);
  });

  it("isTransientNetworkError handles plain object with null details", () => {
    // Plain object shape from Supabase executeWithRetry catch handler
    const error = makePlainPostgrestWithNulls({
      message: "TypeError: Failed to fetch",
    });
    expect(() => isTransientNetworkError(error as unknown as Error)).not.toThrow();
    expect(isTransientNetworkError(error as unknown as Error)).toBe(true);
  });
});

// =============================================================================
// PostgREST errors with null hint field
// =============================================================================

describe("PostgREST errors with null hint", () => {
  it("captureSupabaseError extracts hint as empty string when hint is null", async () => {
    captureExceptionMock.mockClear();
    const error = new PostgrestError({
      message: "duplicate key value violates unique constraint",
      details: "Key (id)=(abc) already exists.",
      hint: null as unknown as string,
      code: "23505",
    });
    captureSupabaseError(error, "pages.insert");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.extra.hint).toBe("");
    expect(opts.extra.details).toBe("Key (id)=(abc) already exists.");
    expect(opts.extra.code).toBe("23505");
  });

  it("captureSupabaseError handles both details: null and hint: null simultaneously", async () => {
    captureExceptionMock.mockClear();
    // Realistic shape from PostgREST HTTP 500 (MEMO-2E)
    const error = {
      message: "server error",
      code: "XX000",
      details: null,
      hint: null,
    };
    captureSupabaseError(error as unknown as Error, "page-tree:fetch-pages");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.extra.details).toBe("");
    expect(opts.extra.hint).toBe("");
    expect(opts.extra.code).toBe("XX000");
  });
});

// =============================================================================
// Supabase auth lock errors with non-standard message format
// =============================================================================

describe("Supabase auth lock errors with non-standard message format", () => {
  it("detects lock-broken AbortError in PostgrestError with null details", () => {
    // Auth lock error where the message contains the lock pattern but details is null
    // (PostgREST 500 wrapping an auth lock failure)
    const error = new PostgrestError({
      message: "AbortError: Lock broken by another request with the 'steal' option.",
      details: null as unknown as string,
      hint: null as unknown as string,
      code: "XX000",
    });
    expect(() => isSupabaseAuthLockError(error)).not.toThrow();
    expect(isSupabaseAuthLockError(error)).toBe(true);
  });

  it("detects lock-released message in plain Error (Supabase auth internals MEMO-18)", () => {
    // Unhandled rejection from Supabase auth internals — the Web Lock API
    // uses "stole it" phrasing when another request takes the lock
    const error = new Error(
      "navigator.locks.request: The lock request 'sb-yoipusltrtbvneuywzkj-auth-token' " +
      "was released because another request stole it.",
    );
    expect(isSupabaseAuthLockError(error)).toBe(true);
  });

  it("detects lock-broken in PostgrestError details when message is generic", () => {
    // PostgrestError where the lock error is in details, not message
    const error = new PostgrestError({
      message: "FetchError: request to https://yoipusltrtbvneuywzkj.supabase.co/rest/v1/pages failed",
      details: "AbortError: Lock broken by another request with the 'steal' option.",
      hint: "",
      code: "",
    });
    expect(isSupabaseAuthLockError(error)).toBe(true);
  });

  it("returns false for non-lock errors with null details", () => {
    const error = new PostgrestError({
      message: "some unrelated error",
      details: null as unknown as string,
      hint: null as unknown as string,
      code: "XX000",
    });
    expect(() => isSupabaseAuthLockError(error)).not.toThrow();
    expect(isSupabaseAuthLockError(error)).toBe(false);
  });
});

// =============================================================================
// fetch errors: TypeError variants (transient classification)
// =============================================================================

describe("fetch TypeError variants (transient classification)", () => {
  it("detects 'TypeError: Failed to fetch' (Chrome/standard)", () => {
    const error = new Error("TypeError: Failed to fetch");
    expect(isTransientNetworkError(error)).toBe(true);
  });

  it("detects 'TypeError: NetworkError when attempting to fetch resource' (Firefox variant)", () => {
    // Firefox uses a different message format
    const error = new Error("NetworkError when attempting to fetch resource.");
    expect(isTransientNetworkError(error)).toBe(true);
  });

  it("detects 'TypeError: Load failed' (Safari)", () => {
    // Safari uses "Load failed" for network errors
    const error = new Error("Load failed");
    expect(isTransientNetworkError(error)).toBe(true);
  });

  it("detects 'TypeError: Failed to fetch' with Supabase hostname suffix", () => {
    // Supabase client appends the hostname in parentheses
    const error = new Error(
      "TypeError: Failed to fetch (yoipusltrtbvneuywzkj.supabase.co)",
    );
    expect(isTransientNetworkError(error)).toBe(true);
  });

  it("detects 'TypeError: fetch failed' (Node.js undici)", () => {
    const error = new Error("TypeError: fetch failed");
    expect(isTransientNetworkError(error)).toBe(true);
  });

  it("returns false for 'TypeError: Cannot read properties of null' (not a network error)", () => {
    const error = new Error("TypeError: Cannot read properties of null (reading 'startsWith')");
    expect(isTransientNetworkError(error)).toBe(false);
  });

  it("returns false for 'TypeError: X is not a function' (not a network error)", () => {
    const error = new Error("TypeError: combineChunks is not a function");
    expect(isTransientNetworkError(error)).toBe(false);
  });
});

// =============================================================================
// FK violation errors from page_versions operations (regression #1114, #1013)
// =============================================================================

describe("FK violation from page_versions operations (regression #1114, #1013)", () => {
  it("detects FK violation as PostgrestError with code 23503", () => {
    // Realistic shape from MEMO-2F: page deleted between auth check and version insert
    const error = new PostgrestError({
      message: "insert or update on table \"page_versions\" violates foreign key constraint \"page_versions_page_id_fkey\"",
      details: "Key (page_id)=(40cd1f0a-63a0-4b11-aee6-6fc5b6dab600) is not present in table \"pages\".",
      hint: "",
      code: "23503",
    });
    expect(isForeignKeyViolationError(error)).toBe(true);
  });

  it("detects FK violation from .insert().select().single() path (missing details/hint)", () => {
    // Edge case from #1013: Supabase returns error object that doesn't pass
    // isPostgrestError duck-type check because details/hint are missing
    const error = new Error(
      "insert or update on table \"page_versions\" violates foreign key constraint \"page_versions_page_id_fkey\"",
    );
    (error as unknown as Record<string, unknown>).code = "23503";
    expect(isForeignKeyViolationError(error)).toBe(true);
  });

  it("detects FK violation by message fallback when code is absent", () => {
    // Fallback path: error has FK violation message but no code property
    const error = new Error(
      "insert or update on table \"page_versions\" violates foreign key constraint \"page_versions_page_id_fkey\"",
    );
    expect(isForeignKeyViolationError(error)).toBe(true);
  });

  it("captureSupabaseError captures FK violation at warning level", async () => {
    captureExceptionMock.mockClear();
    const error = new PostgrestError({
      message: "insert or update on table \"page_versions\" violates foreign key constraint \"page_versions_page_id_fkey\"",
      details: "Key (page_id)=(40cd1f0a-63a0-4b11-aee6-6fc5b6dab600) is not present in table \"pages\".",
      hint: "",
      code: "23503",
    });
    captureSupabaseError(error, "page-versions:create");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.level).toBe("warning");
    expect(opts.extra.operation).toBe("page-versions:create");
    expect(opts.extra.code).toBe("23503");
  });

  it("detects FK violation on page_versions restore path", () => {
    // From #1114: version restore inserts a snapshot referencing a deleted page
    const error = new PostgrestError({
      message: "insert or update on table \"page_versions\" violates foreign key constraint \"page_versions_page_id_fkey\"",
      details: "Key (page_id)=(a1b2c3d4-e5f6-7890-abcd-ef1234567890) is not present in table \"pages\".",
      hint: null as unknown as string,
      code: "23503",
    });
    expect(isForeignKeyViolationError(error)).toBe(true);
  });
});

// =============================================================================
// Statement timeout errors (regression from #1240)
// =============================================================================

describe("Statement timeout errors (regression #1240)", () => {
  it("detects statement timeout as PostgrestError with code 57014", () => {
    // Realistic shape from Sentry: query timeout on pages list fetch
    const error = new PostgrestError({
      message: "canceling statement due to statement timeout",
      details: "",
      hint: "",
      code: "57014",
    });
    expect(isStatementTimeoutError(error)).toBe(true);
  });

  it("detects statement timeout from generic Error with code property", () => {
    // Thrown path: Supabase wraps the timeout as a generic Error with code
    const error = new Error("canceling statement due to statement timeout");
    (error as unknown as Record<string, unknown>).code = "57014";
    expect(isStatementTimeoutError(error)).toBe(true);
  });

  it("captureSupabaseError captures statement timeout at warning level", async () => {
    captureExceptionMock.mockClear();
    const error = new PostgrestError({
      message: "canceling statement due to statement timeout",
      details: "",
      hint: "",
      code: "57014",
    });
    captureSupabaseError(error, "page-tree:fetch-pages");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.level).toBe("warning");
    expect(opts.extra.operation).toBe("page-tree:fetch-pages");
    expect(opts.extra.code).toBe("57014");
  });

  it("statement timeout with null details does not crash", () => {
    const error = new PostgrestError({
      message: "canceling statement due to statement timeout",
      details: null as unknown as string,
      hint: null as unknown as string,
      code: "57014",
    });
    expect(() => isStatementTimeoutError(error)).not.toThrow();
    expect(isStatementTimeoutError(error)).toBe(true);
  });
});

// =============================================================================
// captureApiError with undefined error argument
// =============================================================================

describe("captureApiError with undefined error argument", () => {
  beforeEach(() => {
    captureExceptionMock.mockClear();
  });

  it("handles undefined error without crashing", async () => {
    // API route catch blocks may pass undefined if the thrown value is undefined
    expect(() => captureApiError(undefined, "feedback:submit")).not.toThrow();
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [captured, opts] = captureExceptionMock.mock.calls[0];
    expect(captured).toBeUndefined();
    // undefined is not an Error, so it goes through the non-transient path
    expect(opts.level).toBeUndefined();
    expect(opts.extra.operation).toBe("feedback:submit");
  });

  it("handles null error without crashing", async () => {
    expect(() => captureApiError(null, "search:query")).not.toThrow();
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [captured, opts] = captureExceptionMock.mock.calls[0];
    expect(captured).toBeNull();
    expect(opts.extra.operation).toBe("search:query");
  });

  it("handles string error without crashing", async () => {
    expect(() => captureApiError("network timeout", "account:update")).not.toThrow();
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [captured, opts] = captureExceptionMock.mock.calls[0];
    expect(captured).toBe("network timeout");
    expect(opts.extra.operation).toBe("account:update");
  });

  it("includes userAgent in extra when provided with non-Error value", async () => {
    captureApiError(undefined, "feedback:submit", "Mozilla/5.0 HeadlessChrome/147.0.0.0");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.extra.userAgent).toBe("Mozilla/5.0 HeadlessChrome/147.0.0.0");
  });
});

// =============================================================================
// isE2ETestRequest with empty event.request (regression from #931)
// =============================================================================

describe("isE2ETestRequest with empty event.request (regression #931)", () => {
  it("returns false when event.request is empty object and no browser context", () => {
    // Manually captured exception: event.request is {} (no headers)
    const event: ErrorEvent = {
      type: undefined,
      request: {},
      exception: { values: [{ value: "SupabaseError: TypeError: fetch failed" }] },
    } as unknown as ErrorEvent;
    expect(isE2ETestRequest(event)).toBe(false);
  });

  it("returns true via browser context when event.request is empty", () => {
    // Sentry SDK enrichment populates event.contexts.browser from the browser
    // environment, even when event.request is empty
    const event: ErrorEvent = {
      type: undefined,
      request: {},
      contexts: {
        browser: { name: "HeadlessChrome", version: "147.0.0.0" },
      },
      exception: { values: [{ value: "SupabaseError: TypeError: fetch failed" }] },
    } as unknown as ErrorEvent;
    expect(isE2ETestRequest(event)).toBe(true);
  });

  it("returns true via extra.userAgent when event.request is undefined", () => {
    // Server-side manually captured exception: event.request is undefined,
    // event.contexts.browser is not populated by the SDK, but captureSupabaseError
    // forwarded the User-Agent into extra.userAgent
    const event: ErrorEvent = {
      type: undefined,
      extra: { userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/147.0.0.0 Safari/537.36" },
      exception: { values: [{ value: "SupabaseError: TypeError: fetch failed" }] },
    } as unknown as ErrorEvent;
    expect(isE2ETestRequest(event)).toBe(true);
  });

  it("returns false when extra.userAgent is a normal Chrome UA", () => {
    const event: ErrorEvent = {
      type: undefined,
      extra: { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/146.0.0.0 Safari/537.36" },
      exception: { values: [{ value: "some error" }] },
    } as unknown as ErrorEvent;
    expect(isE2ETestRequest(event)).toBe(false);
  });

  it("returns true via isolation scope when all other fields are empty", () => {
    // on_request_error hook: event.request is null, event.contexts.browser
    // is not populated, but the isolation scope has normalizedRequest headers
    mockScopeData = {
      sdkProcessingMetadata: {
        normalizedRequest: {
          headers: {
            "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/147.0.0.0 Safari/537.36",
          },
        },
      },
    };
    const event: ErrorEvent = {
      type: undefined,
      exception: { values: [{ value: "some server error" }] },
    } as unknown as ErrorEvent;
    expect(isE2ETestRequest(event)).toBe(true);
    mockScopeData = {};
  });

  it("returns false when isolation scope has normal Chrome UA", () => {
    mockScopeData = {
      sdkProcessingMetadata: {
        normalizedRequest: {
          headers: {
            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/146.0.0.0 Safari/537.36",
          },
        },
      },
    };
    const event: ErrorEvent = {
      type: undefined,
      exception: { values: [{ value: "some server error" }] },
    } as unknown as ErrorEvent;
    expect(isE2ETestRequest(event)).toBe(false);
    mockScopeData = {};
  });
});

// =============================================================================
// End-to-end classification pipeline: realistic production error shapes
// =============================================================================

describe("end-to-end classification pipeline with production error shapes", () => {
  beforeEach(() => {
    captureExceptionMock.mockClear();
  });

  it("PostgREST 500 with null details/hint is wrapped and captured at error level", async () => {
    // Realistic shape from MEMO-2E: PostgREST returns HTTP 500 with null fields
    const error = {
      message: "server error",
      code: "XX000",
      details: null,
      hint: null,
    };
    captureSupabaseError(error as unknown as Error, "page-tree:fetch-pages");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [captured, opts] = captureExceptionMock.mock.calls[0];
    // Plain object should be wrapped in Error
    expect(captured).toBeInstanceOf(Error);
    expect(captured.name).toBe("SupabaseError");
    // Not a transient error, so no level override (defaults to error)
    expect(opts.level).toBeUndefined();
    expect(opts.extra.details).toBe("");
    expect(opts.extra.hint).toBe("");
  });

  it("transient fetch error with null details is captured at warning level", async () => {
    // PostgREST wraps a fetch failure with null details
    const error = {
      message: "TypeError: fetch failed",
      code: "",
      details: null,
      hint: null,
    };
    captureSupabaseError(error as unknown as Error, "page-tree:workspace-lookup");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [captured, opts] = captureExceptionMock.mock.calls[0];
    expect(captured).toBeInstanceOf(Error);
    expect(opts.level).toBe("warning");
  });

  it("FK violation during E2E test teardown is captured at warning with userAgent", async () => {
    // Realistic shape from #1114: E2E test deletes workspace, concurrent
    // version restore hits FK violation
    const error = new PostgrestError({
      message: "insert or update on table \"page_versions\" violates foreign key constraint \"page_versions_page_id_fkey\"",
      details: "Key (page_id)=(40cd1f0a-63a0-4b11-aee6-6fc5b6dab600) is not present in table \"pages\".",
      hint: "",
      code: "23503",
    });
    captureSupabaseError(
      error,
      "page-versions:restore",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/147.0.0.0 Safari/537.36",
    );
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.level).toBe("warning");
    expect(opts.extra.userAgent).toContain("HeadlessChrome");
    expect(opts.extra.code).toBe("23503");
  });

  it("auth lock error with null details is captured at warning level", async () => {
    // Auth lock contention where PostgREST wraps the error with null details
    const error = new PostgrestError({
      message: "AbortError: Lock broken by another request with the 'steal' option.",
      details: null as unknown as string,
      hint: null as unknown as string,
      code: "XX000",
    });
    captureSupabaseError(error, "auth:refresh");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.level).toBe("warning");
    expect(opts.extra.details).toBe("");
    expect(opts.extra.hint).toBe("");
  });

  it("isPostgrestError returns true for plain objects with null details/hint", () => {
    // The duck-type check uses `in` operator which returns true for null values
    const error = { message: "error", code: "XX000", details: null, hint: null };
    expect(isPostgrestError(error)).toBe(true);
  });

  it("captureApiError with transient Error includes warning level", async () => {
    // Realistic shape from #856: TypeError: fetch failed in API route catch block
    const error = new Error("TypeError: fetch failed");
    captureApiError(error, "feedback:submit");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.level).toBe("warning");
    expect(opts.extra.operation).toBe("feedback:submit");
    expect(opts.extra.message).toBe("TypeError: fetch failed");
  });

  it("captureApiError with Safari 'Load failed' includes warning level", async () => {
    const error = new Error("Load failed");
    captureApiError(error, "search:query");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.level).toBe("warning");
  });
});
