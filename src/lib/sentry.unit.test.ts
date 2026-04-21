import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";
import { PostgrestError } from "@supabase/supabase-js";

const captureExceptionMock = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => captureExceptionMock(...args),
}));

import {
  isTransientNetworkError,
  isSchemaNotFoundError,
  isInsufficientPrivilegeError,
  captureSupabaseError,
  isNextjsInternalNoise,
  isReactLexicalDomConflict,
} from "./sentry";

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

  it("captures non-network, non-RLS errors at default (error) level", async () => {
    const error = makePostgrestError({
      message: "duplicate key value violates unique constraint",
      code: "23505",
    });
    captureSupabaseError(error, "pages.insert");
    await flush();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.level).toBeUndefined();
    expect(opts.extra.operation).toBe("pages.insert");
    expect(opts.extra.code).toBe("23505");
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
