import { describe, it, expect, vi, beforeEach } from "vitest";

const insertMock = vi.fn();
const fromMock = vi.fn(() => ({ insert: insertMock }));
const createClientMock = vi.fn(() => Promise.resolve({ from: fromMock }));
const captureSupabaseErrorMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createClientMock(),
}));

vi.mock("@/lib/sentry", () => ({
  captureSupabaseError: (error: unknown, operation: unknown) =>
    captureSupabaseErrorMock(error, operation),
}));

import { trackEvent, trackEventClient } from "./track-event";

beforeEach(() => {
  vi.clearAllMocks();
  insertMock.mockResolvedValue({ error: null });
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
});

describe("trackEventClient", () => {
  it("inserts into usage_events via the provided client", async () => {
    const clientInsertMock = vi.fn().mockResolvedValue({ error: null });
    const clientFromMock = vi.fn(() => ({ insert: clientInsertMock }));
    const fakeClient = { from: clientFromMock } as never;

    trackEventClient(fakeClient, "workspace.created", "user-789", {
      workspaceId: "ws-new",
    });

    // Allow the microtask to resolve
    await vi.waitFor(() => {
      expect(clientFromMock).toHaveBeenCalledWith("usage_events");
    });

    expect(clientInsertMock).toHaveBeenCalledWith({
      event_name: "workspace.created",
      user_id: "user-789",
      workspace_id: "ws-new",
      page_path: null,
      metadata: null,
    });
  });

  it("captures errors in Sentry without throwing", async () => {
    const dbError = new Error("RLS violation");
    const clientInsertMock = vi.fn().mockResolvedValue({ error: dbError });
    const clientFromMock = vi.fn(() => ({ insert: clientInsertMock }));
    const fakeClient = { from: clientFromMock } as never;

    trackEventClient(fakeClient, "member.invited", "user-789");

    await vi.waitFor(() => {
      expect(captureSupabaseErrorMock).toHaveBeenCalledWith(
        dbError,
        "trackEvent:member.invited",
      );
    });
  });

  it("captures rejected promises without throwing", async () => {
    const clientInsertMock = vi
      .fn()
      .mockRejectedValue(new Error("network down"));
    const clientFromMock = vi.fn(() => ({ insert: clientInsertMock }));
    const fakeClient = { from: clientFromMock } as never;

    trackEventClient(fakeClient, "editor.export", "user-789");

    await vi.waitFor(() => {
      expect(captureSupabaseErrorMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: "network down" }),
        "trackEvent:editor.export",
      );
    });
  });
});
