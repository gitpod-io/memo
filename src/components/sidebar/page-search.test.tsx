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
    // Regression test for the microtask ordering bug: when the debounce
    // effect re-runs (e.g. because workspaceId resolved), it aborts the
    // old controller and sets loading=true synchronously. The aborted
    // fetch's finally block runs later as a microtask. If the finally
    // block used signal.aborted to decide whether to clear loading, a
    // race could leave loading=true permanently. The generation counter
    // prevents this.

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

    // Advance past debounce — search fires but workspaceId is null so it
    // returns immediately with searchStatus="done"
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    // Even though search is done, workspace hasn't resolved so skeletons
    // should still show (not the empty state)
    const searchResults = screen.getByRole("listbox");
    const skeletons = searchResults.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
    expect(
      screen.queryByText("No pages match your search")
    ).not.toBeInTheDocument();

    // Now resolve the workspace — the workspaceId effect triggers an
    // immediate re-search (no debounce) via the re-trigger effect.
    await act(async () => {
      resolveWorkspace!({
        data: { id: "ws-uuid-123" },
        error: null,
      });
      await vi.advanceTimersByTimeAsync(50);
    });

    // Now the empty state should show — no extra 300ms debounce needed
    expect(
      screen.getByText("No pages match your search")
    ).toBeInTheDocument();
  });

  it("shows empty state immediately when workspace resolves after search debounce", async () => {
    // Regression test for #178: when the workspace resolves after the
    // search debounce already fired (with workspaceId=null), the search
    // must re-fire immediately without an additional 300ms debounce.
    // The old code recreated the search callback when workspaceId changed,
    // which re-triggered the debounce effect with a fresh 300ms delay.
    // With production latency this caused the total wait to exceed the
    // E2E timeout, leaving skeletons visible indefinitely.
    let resolveWorkspace: (value: unknown) => void;
    mockMaybeSingle.mockReturnValue(
      new Promise((resolve) => {
        resolveWorkspace = resolve;
      })
    );

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    });

    render(<PageSearch />);

    const input = screen.getByRole("combobox", { name: /search pages/i });
    await user.click(input);
    await user.type(input, "zzzyyyxxxnonexistent999");

    // Advance past debounce — search fires but workspaceId is null
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    // Skeletons should show (workspace not resolved)
    const searchResults = screen.getByRole("listbox");
    expect(searchResults.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    expect(screen.queryByText("No pages match your search")).not.toBeInTheDocument();

    // No fetch should have been made yet (workspaceId was null)
    expect(fetchMock).not.toHaveBeenCalled();

    // Resolve workspace — search should re-fire immediately (no debounce)
    await act(async () => {
      resolveWorkspace!({
        data: { id: "ws-uuid-123" },
        error: null,
      });
      await vi.advanceTimersByTimeAsync(50);
    });

    // The fetch should have been called with the query
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("zzzyyyxxxnonexistent999"),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );

    // Empty state should show immediately — no extra 300ms debounce
    expect(
      screen.getByText("No pages match your search")
    ).toBeInTheDocument();
    expect(searchResults.querySelectorAll(".animate-pulse").length).toBe(0);
  });

  it("shows empty state when workspace resolves to null (workspace not found)", async () => {
    // Regression test for #162: when workspaceId is null and
    // workspaceResolved is true, the old code left `searched=false`
    // in the early return path, causing neither skeletons nor empty
    // state to render. The new searchStatus="done" transition in the
    // early return path fixes this.
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

    // Advance past debounce — search fires, workspaceId is null,
    // early return sets searchStatus="done"
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
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
});
