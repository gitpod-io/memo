import "@testing-library/jest-dom/vitest";
import { render, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- Mocks ---------------------------------------------------------------

const mockPush = vi.fn();
const mockWorkspaceSlug = "test-workspace";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ workspaceSlug: mockWorkspaceSlug }),
}));

const mockInsertSingle = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === "workspaces") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { id: "ws-uuid-123" },
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === "pages") {
        return {
          select: () => ({
            eq: () => ({
              order: () =>
                Promise.resolve({ data: [], error: null }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: mockInsertSingle,
            }),
          }),
        };
      }
      if (table === "favorites") {
        return {
          select: () => ({
            eq: () => ({
              eq: () =>
                Promise.resolve({ data: [], error: null }),
            }),
          }),
        };
      }
      return {};
    },
  }),
}));

vi.mock("@/lib/sentry", () => ({
  captureSupabaseError: vi.fn(),
  isTransientNetworkError: vi.fn().mockReturnValue(false),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { PageTree } from "./page-tree";

function createMockMatchMedia(matches: boolean) {
  return vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe("PageTree ⌘+N shortcut", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", createMockMatchMedia(false));
    mockPush.mockClear();
    mockInsertSingle.mockReset();
    mockInsertSingle.mockResolvedValue({
      data: {
        id: "new-page-id",
        workspace_id: "ws-uuid-123",
        parent_id: null,
        title: "",
        position: 0,
        created_by: "user-123",
      },
      error: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("⌘+N creates a new page and navigates to it", async () => {
    render(<PageTree userId="user-123" />);

    // Wait for workspace resolution and page fetch
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "n",
          metaKey: true,
          bubbles: true,
        }),
      );
      // Allow the async handleCreate to complete
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockInsertSingle).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith(
      `/${mockWorkspaceSlug}/new-page-id`,
    );
  });

  it("Ctrl+N creates a new page and navigates to it", async () => {
    render(<PageTree userId="user-123" />);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "n",
          ctrlKey: true,
          bubbles: true,
        }),
      );
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockInsertSingle).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith(
      `/${mockWorkspaceSlug}/new-page-id`,
    );
  });

  it("ignores N keydown without meta or ctrl modifier", async () => {
    render(<PageTree userId="user-123" />);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "n",
          bubbles: true,
        }),
      );
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockInsertSingle).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("ignores ⌘+Shift+N (does not intercept browser new-window-incognito)", async () => {
    render(<PageTree userId="user-123" />);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "n",
          metaKey: true,
          shiftKey: true,
          bubbles: true,
        }),
      );
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockInsertSingle).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("calls preventDefault to suppress browser default new-window behavior", async () => {
    render(<PageTree userId="user-123" />);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const event = new KeyboardEvent("keydown", {
      key: "n",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");

    await act(async () => {
      window.dispatchEvent(event);
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(preventDefaultSpy).toHaveBeenCalled();
  });
});
