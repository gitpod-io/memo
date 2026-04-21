import { describe, it, expect, vi, beforeEach } from "vitest";

const captureSupabaseErrorMock = vi.fn();

vi.mock("@/lib/sentry", () => ({
  captureSupabaseError: (error: unknown, operation: unknown) =>
    captureSupabaseErrorMock(error, operation),
}));

import { trackEventClient } from "./track-event";

beforeEach(() => {
  vi.clearAllMocks();
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
