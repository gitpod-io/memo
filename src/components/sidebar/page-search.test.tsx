import "@testing-library/jest-dom/vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- Mocks -----------------------------------------------------------

const mockWorkspaceSlug = "test-workspace";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ workspaceSlug: mockWorkspaceSlug }),
}));

// Supabase mock: workspace lookup returns a valid ID
const mockMaybeSingle = vi.fn().mockResolvedValue({
  data: { id: "ws-uuid-123" },
  error: null,
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: mockMaybeSingle,
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/sentry", () => ({
  captureSupabaseError: vi.fn(),
  isTransientNetworkError: vi.fn().mockReturnValue(false),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

// Track fetch calls
let fetchMock: ReturnType<typeof vi.fn<typeof globalThis.fetch>>;

import { PageSearch } from "./page-search";

describe("PageSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows empty state when search returns no results", async () => {
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    });

    render(<PageSearch />);

    // Wait for workspace resolution (async .then callback)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    const input = screen.getByRole("combobox", { name: /search pages/i });
    await user.click(input);
    await user.type(input, "zzzyyyxxxnonexistent999");

    // Advance past the 300ms debounce
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    // The fetch should have been called with the query and an abort signal
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("zzzyyyxxxnonexistent999"),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );

    // The empty state message should be visible
    expect(
      screen.getByText("No pages match your search")
    ).toBeInTheDocument();

    // Skeleton loaders should NOT be visible
    const searchResults = screen.getByRole("listbox");
    const skeletons = searchResults.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBe(0);
  });

  it("shows skeleton loaders while search is in progress", async () => {
    // Make fetch hang (never resolve)
    let resolveFetch: (value: Response | PromiseLike<Response>) => void;
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      })
    );

    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    });

    render(<PageSearch />);

    // Wait for workspace resolution
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    const input = screen.getByRole("combobox", { name: /search pages/i });
    await user.click(input);
    await user.type(input, "test query");

    // Advance past debounce but fetch is still pending
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    // Skeleton loaders should be visible while loading
    const searchResults = screen.getByRole("listbox");
    const skeletons = searchResults.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);

    // Now resolve the fetch with empty results
    await act(async () => {
      resolveFetch!(new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
      await vi.advanceTimersByTimeAsync(50);
    });

    // Empty state should now show
    expect(
      screen.getByText("No pages match your search")
    ).toBeInTheDocument();
  });

  it("aborts stale fetch when query changes rapidly", async () => {
    // Track abort signals to verify cancellation
    const signals: AbortSignal[] = [];
    fetchMock.mockImplementation((_url: string | URL | Request, init?: RequestInit) => {
      if (init?.signal) signals.push(init.signal);
      return new Promise<Response>((resolve) => {
        // Resolve after a delay, but only if not aborted
        setTimeout(() => {
          resolve(new Response(JSON.stringify({ results: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }));
        }, 100);
      });
    });

    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    });

    render(<PageSearch />);

    // Wait for workspace resolution
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    const input = screen.getByRole("combobox", { name: /search pages/i });
    await user.click(input);
    await user.type(input, "first");

    // Advance past debounce to trigger first fetch
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    // First fetch should be in-flight
    expect(signals.length).toBe(1);
    expect(signals[0].aborted).toBe(false);

    // Type a new query before first fetch resolves
    await user.clear(input);
    await user.type(input, "second");

    // The first signal should now be aborted
    expect(signals[0].aborted).toBe(true);

    // Advance past debounce for second query
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    // Second fetch should have been called
    expect(signals.length).toBe(2);

    // Let second fetch resolve
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

    // Should show empty state (second query returned no results)
    expect(
      screen.getByText("No pages match your search")
    ).toBeInTheDocument();
  });

  it("shows skeletons while workspace is resolving even after search completes", async () => {
    // Make workspace resolution hang
    let resolveWorkspace: (value: unknown) => void;
    mockMaybeSingle.mockReturnValue(
      new Promise((resolve) => {
        resolveWorkspace = resolve;
      })
    );

    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    });

    render(<PageSearch />);

    const input = screen.getByRole("combobox", { name: /search pages/i });
    await user.click(input);
    await user.type(input, "test query");

    // Advance past debounce — search fires but workspaceId is null so it
    // returns immediately with loading=false
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    // Even though loading is false, workspace hasn't resolved so skeletons
    // should still show (not the empty state)
    const searchResults = screen.getByRole("listbox");
    const skeletons = searchResults.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
    expect(
      screen.queryByText("No pages match your search")
    ).not.toBeInTheDocument();

    // Now resolve the workspace — this triggers a new search via the
    // search callback getting a new workspaceId reference
    await act(async () => {
      resolveWorkspace!({
        data: { id: "ws-uuid-123" },
        error: null,
      });
      await vi.advanceTimersByTimeAsync(50);
    });

    // Debounce effect re-runs because search changed (new workspaceId).
    // Advance past the new 300ms debounce.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    // Now the empty state should show
    expect(
      screen.getByText("No pages match your search")
    ).toBeInTheDocument();
  });
});
