import { describe, it, expect, vi, beforeEach } from "vitest";
import { PostgrestError } from "@supabase/supabase-js";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { retryOnNetworkError } from "./retry";

function makePostgrestError(
  overrides: Partial<PostgrestError> = {},
): PostgrestError {
  return new PostgrestError({
    message: overrides.message ?? "some error",
    details: overrides.details ?? "",
    hint: overrides.hint ?? "",
    code: overrides.code ?? "PGRST000",
  });
}

function networkError(): PostgrestError {
  return makePostgrestError({
    message: "TypeError: Failed to fetch",
    details: "TypeError: Failed to fetch",
  });
}

describe("retryOnNetworkError", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("returns immediately on success (no retries)", async () => {
    const fn = vi.fn().mockResolvedValue({ data: { id: "ws-1" }, error: null });

    const promise = retryOnNetworkError(fn, { baseDelayMs: 100 });
    const result = await promise;

    expect(fn).toHaveBeenCalledOnce();
    expect(result).toEqual({ data: { id: "ws-1" }, error: null });
  });

  it("returns immediately on non-network error (no retries)", async () => {
    const rlsError = makePostgrestError({
      message: "new row violates row-level security policy",
      code: "42501",
    });
    const fn = vi
      .fn()
      .mockResolvedValue({ data: null, error: rlsError });

    const promise = retryOnNetworkError(fn, { baseDelayMs: 100 });
    const result = await promise;

    expect(fn).toHaveBeenCalledOnce();
    expect((result.error as PostgrestError | null)?.code).toBe("42501");
  });

  it("retries on transient network error and succeeds", async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: networkError() })
      .mockResolvedValueOnce({ data: { id: "ws-1" }, error: null });

    const promise = retryOnNetworkError(fn, {
      maxRetries: 2,
      baseDelayMs: 100,
    });

    // First call happens immediately, then waits 100ms before retry
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(fn).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ data: { id: "ws-1" }, error: null });
  });

  it("retries up to maxRetries and returns last error", async () => {
    const fn = vi
      .fn()
      .mockResolvedValue({ data: null, error: networkError() });

    const promise = retryOnNetworkError(fn, {
      maxRetries: 2,
      baseDelayMs: 100,
    });

    // Retry 1 after 100ms
    await vi.advanceTimersByTimeAsync(100);
    // Retry 2 after 200ms (exponential backoff)
    await vi.advanceTimersByTimeAsync(200);

    const result = await promise;

    // 1 initial + 2 retries = 3 calls
    expect(fn).toHaveBeenCalledTimes(3);
    expect(result.error?.message).toBe("TypeError: Failed to fetch");
  });

  it("uses exponential backoff between retries", async () => {
    const fn = vi
      .fn()
      .mockResolvedValue({ data: null, error: networkError() });

    const promise = retryOnNetworkError(fn, {
      maxRetries: 3,
      baseDelayMs: 100,
    });

    // After initial call, first retry at 100ms
    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(100);
    expect(fn).toHaveBeenCalledTimes(2);

    // Second retry at 200ms (100 * 2^1)
    await vi.advanceTimersByTimeAsync(200);
    expect(fn).toHaveBeenCalledTimes(3);

    // Third retry at 400ms (100 * 2^2)
    await vi.advanceTimersByTimeAsync(400);
    expect(fn).toHaveBeenCalledTimes(4);

    await promise;
  });

  it("defaults to 2 retries and 500ms base delay", async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: networkError() })
      .mockResolvedValueOnce({ data: null, error: networkError() })
      .mockResolvedValueOnce({ data: { id: "ws-1" }, error: null });

    const promise = retryOnNetworkError(fn);

    await vi.advanceTimersByTimeAsync(500); // first retry
    await vi.advanceTimersByTimeAsync(1000); // second retry

    const result = await promise;

    expect(fn).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ data: { id: "ws-1" }, error: null });
  });

  it("retries on thrown transient network error and succeeds (#937)", async () => {
    const fetchError = new TypeError("fetch failed");
    const fn = vi
      .fn()
      .mockRejectedValueOnce(fetchError)
      .mockResolvedValueOnce({ data: { id: "ws-1" }, error: null });

    const promise = retryOnNetworkError(fn, {
      maxRetries: 1,
      baseDelayMs: 100,
    });

    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(fn).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ data: { id: "ws-1" }, error: null });
  });

  it("re-throws transient error after all retries exhausted (#937)", async () => {
    const fetchError = new TypeError("fetch failed");
    const fn = vi.fn().mockRejectedValue(fetchError);

    let caughtError: Error | null = null;
    const promise = retryOnNetworkError(fn, {
      maxRetries: 1,
      baseDelayMs: 100,
    }).catch((err: Error) => {
      caughtError = err;
    });

    await vi.advanceTimersByTimeAsync(100);
    await promise;

    expect(caughtError).toBe(fetchError);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-transient thrown errors", async () => {
    const appError = new Error("Something unexpected");
    const fn = vi.fn().mockRejectedValue(appError);

    const promise = retryOnNetworkError(fn, {
      maxRetries: 2,
      baseDelayMs: 100,
    });

    await expect(promise).rejects.toThrow("Something unexpected");
    expect(fn).toHaveBeenCalledOnce();
  });
});
