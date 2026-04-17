import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";
import { PostgrestError } from "@supabase/supabase-js";

const captureExceptionMock = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => captureExceptionMock(...args),
}));

import {
  isTransientNetworkError,
  captureSupabaseError,
  isNextjsInternalNoise,
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

describe("captureSupabaseError", () => {
  beforeEach(() => {
    captureExceptionMock.mockClear();
  });

  it("captures transient network errors at warning level", () => {
    const error = new Error("Failed to fetch");
    captureSupabaseError(error, "page-tree:workspace-lookup");

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.level).toBe("warning");
    expect(opts.extra.operation).toBe("page-tree:workspace-lookup");
  });

  it("captures PostgrestError with network details at warning level", () => {
    const error = makePostgrestError({
      message: "request failed",
      details: "TypeError: Failed to fetch",
    });
    captureSupabaseError(error, "page-tree:fetch-pages");

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.level).toBe("warning");
  });

  it("captures non-network errors at default (error) level", () => {
    const error = makePostgrestError({
      message: "new row violates row-level security policy",
      code: "42501",
    });
    captureSupabaseError(error, "pages.insert");

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const [, opts] = captureExceptionMock.mock.calls[0];
    expect(opts.level).toBeUndefined();
    expect(opts.extra.operation).toBe("pages.insert");
    expect(opts.extra.code).toBe("42501");
  });

  it("includes PostgrestError fields in extra", () => {
    const error = makePostgrestError({
      message: "duplicate key",
      code: "23505",
      details: "Key (id)=(abc) already exists.",
      hint: "",
    });
    captureSupabaseError(error, "pages.insert");

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
