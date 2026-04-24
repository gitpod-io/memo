import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DatabaseProperty } from "@/lib/types";
import { RelationRenderer, RelationEditor } from "./relation";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ workspaceSlug: "test-ws" }),
}));

// Supabase mock — chain: from().select().in() or from().select().eq().is().order()
const mockSupabaseData = vi.fn();

vi.mock("@/lib/supabase/lazy-client", () => ({
  getClient: vi.fn().mockResolvedValue({
    from: () => ({
      select: () => ({
        in: () => mockSupabaseData(),
        eq: () => ({
          is: () => ({
            order: () => mockSupabaseData(),
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/sentry", () => ({
  captureSupabaseError: vi.fn(),
  isInsufficientPrivilegeError: vi.fn().mockReturnValue(false),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProp(
  config: Record<string, unknown> = { database_id: "target-db-1" },
): DatabaseProperty {
  return {
    id: "prop-1",
    database_id: "db-1",
    name: "Related",
    type: "relation",
    config,
    position: 0,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// RelationRenderer
// ---------------------------------------------------------------------------

describe("RelationRenderer", () => {
  it("renders loading skeletons while resolving page IDs", () => {
    // Keep the promise pending
    mockSupabaseData.mockReturnValue(new Promise(() => {}));

    const { container } = render(
      <RelationRenderer
        value={{ page_ids: ["page-1"] }}
        property={makeProp()}
      />,
    );
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("renders resolved page titles as pills", async () => {
    mockSupabaseData.mockResolvedValue({
      data: [
        { id: "page-1", title: "Task Alpha", icon: "📋" },
      ],
      error: null,
    });

    render(
      <RelationRenderer
        value={{ page_ids: ["page-1"] }}
        property={makeProp()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Task Alpha")).toBeInTheDocument();
    });
    expect(screen.getByText("📋")).toBeInTheDocument();
  });

  it("renders 'Deleted page' for pages not found", async () => {
    mockSupabaseData.mockResolvedValue({
      data: [],
      error: null,
    });

    render(
      <RelationRenderer
        value={{ page_ids: ["missing-page"] }}
        property={makeProp()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Deleted page")).toBeInTheDocument();
    });
  });

  it("renders nothing when page_ids is empty", () => {
    const { container } = render(
      <RelationRenderer value={{ page_ids: [] }} property={makeProp()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when page_ids is absent", () => {
    const { container } = render(
      <RelationRenderer value={{}} property={makeProp()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("navigates to page on pill click", async () => {
    const user = userEvent.setup();
    mockSupabaseData.mockResolvedValue({
      data: [{ id: "page-1", title: "Task Alpha", icon: null }],
      error: null,
    });

    render(
      <RelationRenderer
        value={{ page_ids: ["page-1"] }}
        property={makeProp()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Task Alpha")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Navigate to Task Alpha"));
    expect(mockPush).toHaveBeenCalledWith("/test-ws/page-1");
  });
});

// ---------------------------------------------------------------------------
// RelationEditor
// ---------------------------------------------------------------------------

describe("RelationEditor", () => {
  it("renders a search input", () => {
    mockSupabaseData.mockReturnValue(new Promise(() => {}));

    render(
      <RelationEditor
        value={{ page_ids: [] }}
        property={makeProp()}
        onChange={vi.fn()}
        onBlur={vi.fn()}
      />,
    );
    expect(screen.getByPlaceholderText("Search pages…")).toBeInTheDocument();
  });

  it("shows message when no target database is configured", () => {
    render(
      <RelationEditor
        value={{ page_ids: [] }}
        property={makeProp({})}
        onChange={vi.fn()}
        onBlur={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/no target database configured/i),
    ).toBeInTheDocument();
  });

  it("renders target rows after loading", async () => {
    mockSupabaseData.mockResolvedValue({
      data: [
        { id: "row-1", title: "Row One", icon: "🔵" },
        { id: "row-2", title: "Row Two", icon: null },
      ],
      error: null,
    });

    render(
      <RelationEditor
        value={{ page_ids: [] }}
        property={makeProp()}
        onChange={vi.fn()}
        onBlur={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Row One")).toBeInTheDocument();
      expect(screen.getByText("Row Two")).toBeInTheDocument();
    });
  });

  it("calls onChange with toggled page_ids when a row is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    mockSupabaseData.mockResolvedValue({
      data: [
        { id: "row-1", title: "Row One", icon: null },
      ],
      error: null,
    });

    render(
      <RelationEditor
        value={{ page_ids: [] }}
        property={makeProp()}
        onChange={onChange}
        onBlur={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Row One")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Add Row One"));
    expect(onChange).toHaveBeenCalledWith({ page_ids: ["row-1"] });
  });

  it("removes a page_id when a selected row is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    mockSupabaseData.mockResolvedValue({
      data: [
        { id: "row-1", title: "Row One", icon: null },
      ],
      error: null,
    });

    render(
      <RelationEditor
        value={{ page_ids: ["row-1"] }}
        property={makeProp()}
        onChange={onChange}
        onBlur={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Row One")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Remove Row One"));
    expect(onChange).toHaveBeenCalledWith({ page_ids: [] });
  });

  it("calls onBlur when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onBlur = vi.fn();

    mockSupabaseData.mockResolvedValue({
      data: [],
      error: null,
    });

    render(
      <RelationEditor
        value={{ page_ids: [] }}
        property={makeProp()}
        onChange={vi.fn()}
        onBlur={onBlur}
      />,
    );

    const input = screen.getByPlaceholderText("Search pages…");
    await user.type(input, "{Escape}");
    expect(onBlur).toHaveBeenCalled();
  });
});
