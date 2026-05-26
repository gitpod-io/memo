import "@testing-library/jest-dom/vitest";
import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

// --- Mocks -----------------------------------------------------------

let mockWorkspaceSlug: string | undefined = "test-workspace";

vi.mock("next/navigation", () => ({
  useParams: () => ({ workspaceSlug: mockWorkspaceSlug }),
}));

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
  isInsufficientPrivilegeError: vi.fn().mockReturnValue(false),
  isSchemaNotFoundError: vi.fn().mockReturnValue(false),
  isTransientNetworkError: vi.fn().mockReturnValue(false),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { WorkspaceProvider, useWorkspace } from "./workspace-context";

// Consumer component that displays context values
function WorkspaceConsumer({ label }: { label: string }) {
  const { workspaceId, workspaceSlug, resolved } = useWorkspace();
  return (
    <div data-testid={label}>
      <span data-testid={`${label}-id`}>{workspaceId ?? "null"}</span>
      <span data-testid={`${label}-slug`}>{workspaceSlug ?? "undefined"}</span>
      <span data-testid={`${label}-resolved`}>{String(resolved)}</span>
    </div>
  );
}

describe("WorkspaceProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockWorkspaceSlug = "test-workspace";
    mockMaybeSingle.mockResolvedValue({
      data: { id: "ws-uuid-123" },
      error: null,
    });
  });

  it("resolves workspace slug to ID once for multiple consumers", async () => {
    await act(async () => {
      render(
        <WorkspaceProvider>
          <WorkspaceConsumer label="a" />
          <WorkspaceConsumer label="b" />
          <WorkspaceConsumer label="c" />
        </WorkspaceProvider>,
      );
    });

    // Flush the async resolution
    await act(async () => {
      await Promise.resolve();
    });

    // Both consumers should see the same resolved workspace ID
    expect(screen.getByTestId("a-id")).toHaveTextContent("ws-uuid-123");
    expect(screen.getByTestId("b-id")).toHaveTextContent("ws-uuid-123");
    expect(screen.getByTestId("c-id")).toHaveTextContent("ws-uuid-123");

    expect(screen.getByTestId("a-slug")).toHaveTextContent("test-workspace");
    expect(screen.getByTestId("a-resolved")).toHaveTextContent("true");

    // The Supabase query should have been called exactly once, not once per consumer
    expect(mockMaybeSingle).toHaveBeenCalledTimes(1);
  });

  it("sets resolved=true and workspaceId=null when no slug is present", async () => {
    mockWorkspaceSlug = undefined;
    mockMaybeSingle.mockClear();

    await act(async () => {
      render(
        <WorkspaceProvider>
          <WorkspaceConsumer label="consumer" />
        </WorkspaceProvider>,
      );
    });

    // Flush microtask from queueMicrotask
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("consumer-id")).toHaveTextContent("null");
    expect(screen.getByTestId("consumer-slug")).toHaveTextContent("undefined");
    expect(screen.getByTestId("consumer-resolved")).toHaveTextContent("true");

    // No Supabase call should be made
    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });

  it("handles lookup errors gracefully", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "not found", code: "PGRST116" },
    });

    await act(async () => {
      render(
        <WorkspaceProvider>
          <WorkspaceConsumer label="consumer" />
        </WorkspaceProvider>,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    // Should be resolved but with null ID
    expect(screen.getByTestId("consumer-resolved")).toHaveTextContent("true");
    expect(screen.getByTestId("consumer-id")).toHaveTextContent("null");
  });
});

describe("useWorkspace", () => {
  it("throws when used outside WorkspaceProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<WorkspaceConsumer label="orphan" />)).toThrow(
      "useWorkspace must be used within a WorkspaceProvider",
    );

    spy.mockRestore();
  });
});
