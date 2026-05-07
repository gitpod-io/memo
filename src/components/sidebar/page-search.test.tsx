import "@testing-library/jest-dom/vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
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
  captureApiError: vi.fn(),
  captureSupabaseError: vi.fn(),
  isTransientNetworkError: vi.fn().mockReturnValue(false),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

vi.mock("@/components/sidebar/sidebar-context", () => ({
  useSidebar: () => ({
    registerSearchRef: vi.fn(),
    isMac: true,
  }),
}));

// Track fetch calls
let fetchMock: ReturnType<typeof vi.fn<typeof globalThis.fetch>>;

import { PageSearch } from "./page-search";

describe("PageSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Reset workspace mock — vi.restoreAllMocks() in afterEach clears
    // the mock implementation, so we must re-set it each test.
    mockMaybeSingle.mockResolvedValue({
      data: { id: "ws-uuid-123" },
      error: null,
    });
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

  it("renders result options when search returns matches", async () => {
    // Regression test for #166: search results with role="option" must
    // render when the API returns matching pages. Verifies the
    // searchStatus state machine transitions correctly from
    // idle → loading → done with results populated.
    const mockResults = {
      results: [
        {
          id: "page-1",
          workspace_id: "ws-uuid-123",
          parent_id: null,
          title: "Quantum Test Document",
          icon: null,
          snippet: "<<Quantum>> test content",
          rank: 0.5,
        },
      ],
    };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(mockResults), {
        status: 200,
        headers: { "Content-Type": "application/json" },
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
    await user.type(input, "quantum");

    // Advance past the 300ms debounce
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    // Result options should be rendered
    const options = screen.getAllByRole("option");
    expect(options.length).toBe(1);
    expect(options[0]).toHaveTextContent("Quantum Test Document");

    // No skeletons or empty state should be visible
    const searchResults = screen.getByRole("listbox");
    const skeletons = searchResults.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBe(0);
    expect(
      screen.queryByText("No pages match your search")
    ).not.toBeInTheDocument();
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

  it("shows empty state even when aborted fetch finally block races with new cycle", async () => {
    // Regression test for the microtask ordering bug: when the effect
    // re-runs (e.g. because workspaceId resolved), it aborts the old
    // controller and sets loading=true synchronously. The aborted
    // fetch's finally block runs later as a microtask. The cancelled
    // flag (set in the effect cleanup) prevents stale callbacks from
    // updating state.

    // First fetch resolves synchronously (simulating a fetch that
    // completes at the same tick the abort fires)
    let fetchCallCount = 0;
    fetchMock.mockImplementation((_url: string | URL | Request, init?: RequestInit) => {
      fetchCallCount++;
      const signal = init?.signal;
      if (fetchCallCount === 1) {
        // First fetch: resolve immediately so its finally block runs
        // in the same microtask queue as the abort
        return Promise.resolve(new Response(JSON.stringify({ results: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }));
      }
      // Second fetch: also resolves, but check abort
      return new Promise<Response>((resolve, reject) => {
        if (signal?.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }
        resolve(new Response(JSON.stringify({ results: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }));
      });
    });

    // Start with workspace already resolved
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
    await user.type(input, "test");

    // Advance past debounce — first fetch fires and resolves immediately
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    // The empty state should be visible (not stuck on skeletons)
    expect(
      screen.getByText("No pages match your search")
    ).toBeInTheDocument();

    const searchResults = screen.getByRole("listbox");
    const skeletons = searchResults.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBe(0);
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

    // Advance time — the unified effect stays in "loading" because
    // workspace hasn't resolved (no fetch fires).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    // Skeletons should show while workspace is resolving
    const searchResults = screen.getByRole("listbox");
    const skeletons = searchResults.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
    expect(
      screen.queryByText("No pages match your search")
    ).not.toBeInTheDocument();

    // No fetch should have been made (workspace not resolved)
    expect(fetchMock).not.toHaveBeenCalled();

    // Resolve workspace — let the promise settle and React re-render.
    await act(async () => {
      resolveWorkspace!({
        data: { id: "ws-uuid-123" },
        error: null,
      });
      await vi.advanceTimersByTimeAsync(50);
    });

    // Advance past the 300ms debounce so the search fires.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    // Now the empty state should show
    expect(
      screen.getByText("No pages match your search")
    ).toBeInTheDocument();
  });

  it("shows empty state when workspace resolves to null (workspace not found)", async () => {
    // Regression test for #162: when workspaceId is null and
    // workspaceResolved is true, the unified effect transitions
    // directly to "done" without firing a fetch.
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    });

    render(<PageSearch />);

    // Wait for workspace resolution (resolves to null)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    const input = screen.getByRole("combobox", { name: /search pages/i });
    await user.click(input);
    await user.type(input, "zzzyyyxxxnonexistent999");

    // The unified effect sees workspaceResolved=true but workspaceId=null,
    // so it transitions directly to "done" (no debounce, no fetch).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    // The empty state should show (not stuck in a blank dropdown)
    expect(
      screen.getByText("No pages match your search")
    ).toBeInTheDocument();

    // No skeletons should be visible
    const searchResults = screen.getByRole("listbox");
    const skeletons = searchResults.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBe(0);

    // No fetch should have been made (workspaceId was null)
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not capture AbortError in Sentry when user types quickly", async () => {
    const captureException = vi.mocked(
      (await import("@sentry/nextjs")).captureException
    );

    // First fetch hangs, second resolves
    let fetchCallCount = 0;
    fetchMock.mockImplementation((_url: string | URL | Request, init?: RequestInit) => {
      fetchCallCount++;
      const signal = init?.signal;
      return new Promise<Response>((resolve, reject) => {
        const onAbort = () => {
          reject(new DOMException("Aborted", "AbortError"));
        };
        if (signal?.aborted) {
          onAbort();
          return;
        }
        signal?.addEventListener("abort", onAbort);
        if (fetchCallCount > 1) {
          resolve(new Response(JSON.stringify({ results: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }));
        }
      });
    });

    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    });

    render(<PageSearch />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    const input = screen.getByRole("combobox", { name: /search pages/i });
    await user.click(input);
    await user.type(input, "first");

    // Trigger first fetch
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    // Type new query — aborts first fetch
    await user.clear(input);
    await user.type(input, "second");

    // Trigger second fetch
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    // Allow microtasks to settle
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    // AbortError should NOT have been sent to Sentry
    expect(captureException).not.toHaveBeenCalled();
  });

  it("shows empty state when workspace resolves after debounce fires (#178)", async () => {
    // Regression test for #178/#181: when workspace resolution is slow,
    // the unified effect stays in "loading" until the workspace resolves.
    // Once resolved, the effect re-runs, debounces, and fires the search.
    // This eliminates the two-effect race condition that caused #178/#181.

    // Make workspace resolution slow
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
    await user.type(input, "zzzyyyxxxnonexistent999");

    // Advance time — the unified effect stays in "loading" because
    // workspace hasn't resolved (no fetch fires).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    // Skeletons should show (workspace not resolved, status is "loading")
    const searchResults = screen.getByRole("listbox");
    expect(searchResults.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    expect(screen.queryByText("No pages match your search")).not.toBeInTheDocument();

    // No fetch yet
    expect(fetchMock).not.toHaveBeenCalled();

    // Resolve workspace — let the promise settle and React re-render.
    await act(async () => {
      resolveWorkspace!({
        data: { id: "ws-uuid-123" },
        error: null,
      });
      await vi.advanceTimersByTimeAsync(50);
    });

    // Advance past the 300ms debounce so the search fires.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    // The fetch should have been called with the workspace ID
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("workspace_id=ws-uuid-123"),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );

    // Empty state should now show (not stuck on skeletons)
    expect(
      screen.getByText("No pages match your search")
    ).toBeInTheDocument();
    expect(searchResults.querySelectorAll(".animate-pulse").length).toBe(0);
  });

  it("shows empty state when workspace resolution rejects (#178)", async () => {
    // Regression test for #178: if retryOnNetworkError rejects,
    // workspaceResolved is set to true (from .catch()) and workspaceId
    // stays null. The unified effect transitions directly to "done".
    mockMaybeSingle.mockImplementation(() => {
      throw new Error("Unexpected Supabase error");
    });

    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    });

    render(<PageSearch />);

    // Wait for workspace resolution to reject and .catch() to fire
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    const input = screen.getByRole("combobox", { name: /search pages/i });
    await user.click(input);
    await user.type(input, "zzzyyyxxxnonexistent999");

    // The unified effect sees workspaceResolved=true but workspaceId=null,
    // so it transitions directly to "done" (no debounce, no fetch).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    // The error should have been captured via captureSupabaseError
    const { captureSupabaseError: mockCaptureSupabaseError } = await import("@/lib/sentry");
    expect(mockCaptureSupabaseError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Unexpected Supabase error" }),
      "page-search:workspace-resolve",
    );

    // Empty state should show (workspaceResolved=true, workspaceId=null)
    expect(
      screen.getByText("No pages match your search")
    ).toBeInTheDocument();

    // No skeletons
    const searchResults = screen.getByRole("listbox");
    expect(searchResults.querySelectorAll(".animate-pulse").length).toBe(0);
  });

  it("cancelled flag prevents stale finally block from blocking new cycle (#192)", async () => {
    // Regression test for #192: the generation counter pattern could
    // leave searchStatus stuck at "loading" if the effect re-ran between
    // fetch start and completion. The cancelled flag fixes this: it's
    // set once in cleanup and stays true, so the stale finally block is
    // discarded and the new cycle completes independently.

    // First fetch hangs, second resolves immediately.
    let resolveFetch1: (value: Response) => void;
    const fetchCalls: string[] = [];
    fetchMock.mockImplementation(
      (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        fetchCalls.push(urlStr);
        const signal = init?.signal;
        if (fetchCalls.length === 1) {
          return new Promise<Response>((resolve, reject) => {
            resolveFetch1 = resolve;
            signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          });
        }
        return Promise.resolve(
          new Response(JSON.stringify({ results: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      },
    );

    render(<PageSearch />);

    // Wait for workspace resolution
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    const input = screen.getByRole("combobox", { name: /search pages/i });

    // Set the first query
    await act(async () => {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "first" } });
    });

    // Advance past debounce — first fetch fires (hangs)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(fetchCalls.length).toBe(1);
    expect(fetchCalls[0]).toContain("first");

    // Change query — effect cleanup cancels first cycle
    await act(async () => {
      fireEvent.change(input, { target: { value: "second" } });
    });

    // Advance past debounce — second fetch fires and resolves
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(fetchCalls.length).toBe(2);
    expect(fetchCalls[1]).toContain("second");

    // Now resolve the first (stale) fetch — its .then() runs but
    // cancelledRef is true for that cycle, so it's discarded.
    await act(async () => {
      resolveFetch1!(
        new Response(JSON.stringify({ results: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      await vi.advanceTimersByTimeAsync(50);
    });

    // The empty state should be visible (from the second fetch)
    expect(
      screen.getByText("No pages match your search"),
    ).toBeInTheDocument();

    // No skeletons should be stuck
    const searchResults = screen.getByRole("listbox");
    expect(searchResults.querySelectorAll(".animate-pulse").length).toBe(0);
  });

  it("never leaves skeletons stuck when workspace resolves mid-debounce (#181)", async () => {
    // Regression test for #181/#192: workspace resolution mid-debounce
    // must not leave searchStatus stuck at "loading". The cancelled flag
    // ensures the old cycle's callbacks are discarded and the new cycle
    // completes normally.

    // Make workspace resolution resolve after 150ms (mid-debounce)
    mockMaybeSingle.mockReturnValue(
      new Promise((resolve) => {
        setTimeout(() => {
          resolve({ data: { id: "ws-uuid-123" }, error: null });
        }, 150);
      })
    );

    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    });

    render(<PageSearch />);

    const input = screen.getByRole("combobox", { name: /search pages/i });
    await user.click(input);
    await user.type(input, "zzzyyyxxxnonexistent999");

    // At this point: query is set, workspace is resolving, effect is
    // in "loading" state waiting for workspace.

    // Advance 150ms — workspace resolves mid-debounce
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

    // Skeletons should still show (debounce hasn't fired yet)
    const searchResults = screen.getByRole("listbox");
    expect(searchResults.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);

    // Advance past the 300ms debounce
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    // Empty state should show — skeletons must NOT be stuck
    expect(
      screen.getByText("No pages match your search")
    ).toBeInTheDocument();
    expect(searchResults.querySelectorAll(".animate-pulse").length).toBe(0);

    // Fetch should have been called with the workspace ID
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("workspace_id=ws-uuid-123"),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });
});
