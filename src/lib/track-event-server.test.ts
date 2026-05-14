import { describe, it, expect, vi, beforeEach } from "vitest";

const insertMock = vi.fn();
const fromMock = vi.fn(() => ({ insert: insertMock }));
const createClientMock = vi.fn(() => Promise.resolve({ from: fromMock }));
const captureSupabaseErrorMock = vi.fn();
const isUsageTrackingDisabledMock = vi.fn().mockReturnValue(false);

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createClientMock(),
}));

vi.mock("@/lib/sentry", () => ({
  captureSupabaseError: (error: unknown, operation: unknown) =>
    captureSupabaseErrorMock(error, operation),
  isTransientNetworkError: (error: Error) =>
    error.message === "fetch failed" ||
    error.message === "Failed to fetch" ||
    error.message === "TypeError: fetch failed",
}));

vi.mock("@/lib/usage-tracking-guard", () => ({
  isUsageTrackingDisabled: () => isUsageTrackingDisabledMock(),
}));

import { trackEvent } from "./track-event-server";

beforeEach(() => {
  vi.clearAllMocks();
  insertMock.mockResolvedValue({ error: null });
  isUsageTrackingDisabledMock.mockReturnValue(false);
});

describe("trackEvent (server)", () => {
  it("inserts into usage_events with all fields", async () => {
    await trackEvent("page.created", "user-123", {
      workspaceId: "ws-456",
      pagePath: "/ws/page-1",
      metadata: { page_id: "page-1" },
    });

    expect(createClientMock).toHaveBeenCalledOnce();
    expect(fromMock).toHaveBeenCalledWith("usage_events");
    expect(insertMock).toHaveBeenCalledWith({
      event_name: "page.created",
      user_id: "user-123",
      workspace_id: "ws-456",
      page_path: "/ws/page-1",
      metadata: { page_id: "page-1" },
    });
  });

  it("inserts with null defaults when options are omitted", async () => {
    await trackEvent("search.used", "user-123");

    expect(insertMock).toHaveBeenCalledWith({
      event_name: "search.used",
      user_id: "user-123",
      workspace_id: null,
      page_path: null,
      metadata: null,
    });
  });

  it("captures Supabase errors in Sentry without throwing", async () => {
    const dbError = new Error("insert failed");
    insertMock.mockResolvedValue({ error: dbError });

    await expect(
      trackEvent("page.created", "user-123"),
    ).resolves.toBeUndefined();

    expect(captureSupabaseErrorMock).toHaveBeenCalledWith(
      dbError,
      "trackEvent:page.created",
    );
  });

  it("captures unexpected exceptions without throwing", async () => {
    createClientMock.mockRejectedValueOnce(new Error("cookies() failed"));

    await expect(
      trackEvent("page.viewed", "user-123"),
    ).resolves.toBeUndefined();

    expect(captureSupabaseErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: "cookies() failed" }),
      "trackEvent:page.viewed",
    );
  });

  it("does not throw on non-Error exceptions", async () => {
    createClientMock.mockRejectedValueOnce("string error");

    await expect(
      trackEvent("page.viewed", "user-123"),
    ).resolves.toBeUndefined();

    // Non-Error values are silently swallowed (no captureSupabaseError call)
    expect(captureSupabaseErrorMock).not.toHaveBeenCalled();
  });

  it("skips insert when usage tracking is disabled", async () => {
    isUsageTrackingDisabledMock.mockReturnValue(true);

    await trackEvent("page.created", "user-123", {
      workspaceId: "ws-456",
    });

    expect(createClientMock).not.toHaveBeenCalled();
    expect(fromMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("retries once on transient fetch failure then succeeds (#1084)", async () => {
    const fetchError = Object.assign(new Error("fetch failed"), {
      code: "",
      details: "",
      hint: "",
    });
    insertMock
      .mockResolvedValueOnce({ error: fetchError })
      .mockResolvedValueOnce({ error: null });

    await trackEvent("feedback.submitted", "user-123");

    expect(insertMock).toHaveBeenCalledTimes(2);
    expect(captureSupabaseErrorMock).not.toHaveBeenCalled();
  });

  it("reports to Sentry after retry exhaustion on transient error (#1084)", async () => {
    const fetchError = Object.assign(new Error("fetch failed"), {
      code: "",
      details: "",
      hint: "",
    });
    insertMock.mockResolvedValue({ error: fetchError });

    await trackEvent("feedback.submitted", "user-123");

    // 1 initial + 1 retry = 2 calls
    expect(insertMock).toHaveBeenCalledTimes(2);
    expect(captureSupabaseErrorMock).toHaveBeenCalledWith(
      fetchError,
      "trackEvent:feedback.submitted",
    );
  });

  it("does not retry on non-transient errors (#1084)", async () => {
    const dbError = Object.assign(new Error("permission denied"), {
      code: "42501",
      details: "",
      hint: "",
    });
    insertMock.mockResolvedValue({ error: dbError });

    await trackEvent("feedback.submitted", "user-123");

    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(captureSupabaseErrorMock).toHaveBeenCalledWith(
      dbError,
      "trackEvent:feedback.submitted",
    );
  });
});
