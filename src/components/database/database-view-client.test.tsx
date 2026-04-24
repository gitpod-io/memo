import "@testing-library/jest-dom/vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const loadDatabaseMock = vi.fn();
const loadWorkspaceMembersMock = vi.fn();
const captureSupabaseErrorMock = vi.fn();

vi.mock("@/lib/database", () => ({
  loadDatabase: (...args: unknown[]) => loadDatabaseMock(...args),
  loadWorkspaceMembers: (...args: unknown[]) => loadWorkspaceMembersMock(...args),
}));

vi.mock("@/lib/sentry", () => ({
  captureSupabaseError: (...args: unknown[]) => captureSupabaseErrorMock(...args),
  isInsufficientPrivilegeError: () => false,
}));

vi.mock("@/lib/capture", () => ({
  lazyCaptureException: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

// Mock next/dynamic to render children synchronously
vi.mock("next/dynamic", () => ({
  default: () => {
    function DynamicStub() {
      return null;
    }
    return DynamicStub;
  },
}));

vi.mock("@/components/page-title", () => ({
  PageTitle: () => <div data-testid="page-title" />,
}));

vi.mock("@/components/page-icon", () => ({
  PageIcon: () => <div data-testid="page-icon" />,
}));

vi.mock("@/components/page-cover", () => ({
  PageCover: () => <div data-testid="page-cover" />,
}));

vi.mock("@/components/database/view-tabs", () => ({
  ViewTabs: () => <div data-testid="view-tabs" />,
  VIEW_TYPE_LABELS: {
    table: "Table",
    board: "Board",
    list: "List",
    calendar: "Calendar",
    gallery: "Gallery",
  },
}));

vi.mock("@/components/database/sort-menu", () => ({
  SortMenu: () => null,
}));

vi.mock("@/components/database/filter-bar", () => ({
  FilterBar: () => null,
}));

vi.mock("@/components/database/rename-property-dialog", () => ({
  RenamePropertyDialog: () => null,
}));

vi.mock("@/components/database/database-view-helpers", () => ({
  ViewConfigDropdown: () => null,
  ComingSoonPlaceholder: () => null,
  DatabaseSkeleton: () => <div data-testid="database-skeleton">Loading...</div>,
}));

vi.mock("@/components/database/csv-export-button", () => ({
  CSVExportButton: () => null,
}));

vi.mock("@/components/database/hooks/use-database-views", () => ({
  useDatabaseViews: () => ({
    activeViewId: "view-1",
    activeView: { id: "view-1", type: "table", config: {}, name: "Default", position: 0, database_id: "db-1", created_at: "", updated_at: "" },
    handleViewChange: vi.fn(),
    handleAddView: vi.fn(),
    handleViewConfigChange: vi.fn(),
    handleRenameView: vi.fn(),
    handleDeleteView: vi.fn(),
    handleDuplicateView: vi.fn(),
    handleReorderViews: vi.fn(),
  }),
}));

vi.mock("@/components/database/hooks/use-database-rows", () => ({
  useDatabaseRows: () => ({
    handleAddRow: vi.fn(),
    handleCardMove: vi.fn(),
    handleCellUpdate: vi.fn(),
    handleDeleteRow: vi.fn(),
  }),
}));

vi.mock("@/components/database/hooks/use-database-properties", () => ({
  useDatabaseProperties: () => ({
    renameDialogOpen: false,
    setRenameDialogOpen: vi.fn(),
    renamingProperty: null,
    handleAddColumn: vi.fn(),
    handleColumnHeaderClick: vi.fn(),
    handlePropertyRename: vi.fn(),
    handleColumnReorder: vi.fn(),
    handleDeleteColumn: vi.fn(),
  }),
}));

vi.mock("@/components/database/hooks/use-database-filters", () => ({
  useDatabaseFilters: () => ({
    activeSorts: [],
    activeFilters: [],
    displayedRows: [],
    handleSortsChange: vi.fn(),
    handleFiltersChange: vi.fn(),
    handleSortToggle: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { DatabaseViewClient } from "./database-view-client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultProps = {
  pageId: "page-1",
  pageTitle: "Test Database",
  pageIcon: null,
  pageCoverUrl: null,
  initialContent: null,
  workspaceId: "ws-1",
  workspaceSlug: "test-workspace",
  userId: "user-1",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DatabaseViewClient error state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadWorkspaceMembersMock.mockResolvedValue({ data: [], error: null });
  });

  it("renders error state when loadDatabase returns an error", async () => {
    const dbError = Object.assign(new Error("relation not found"), {
      code: "PGRST205",
      details: "",
      hint: "",
    });
    loadDatabaseMock.mockResolvedValue({ data: null, error: dbError });

    await act(async () => {
      render(<DatabaseViewClient {...defaultProps} />);
    });

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(
      screen.getByText("Failed to load database. Please check your connection and try again."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("reports the error to Sentry via captureSupabaseError", async () => {
    const dbError = Object.assign(new Error("network error"), {
      code: "PGRST000",
      details: "",
      hint: "",
    });
    loadDatabaseMock.mockResolvedValue({ data: null, error: dbError });

    await act(async () => {
      render(<DatabaseViewClient {...defaultProps} />);
    });

    expect(captureSupabaseErrorMock).toHaveBeenCalledWith(
      dbError,
      "database-view-client.load",
    );
  });

  it("renders error state when loadDatabase returns null data without error", async () => {
    loadDatabaseMock.mockResolvedValue({ data: null, error: null });

    await act(async () => {
      render(<DatabaseViewClient {...defaultProps} />);
    });

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("retries loading when 'Try again' is clicked", async () => {
    const user = userEvent.setup();
    const dbError = Object.assign(new Error("timeout"), {
      code: "57014",
      details: "",
      hint: "",
    });

    // First call fails, second succeeds
    loadDatabaseMock
      .mockResolvedValueOnce({ data: null, error: dbError })
      .mockResolvedValueOnce({
        data: { properties: [], views: [], rows: [] },
        error: null,
      });

    await act(async () => {
      render(<DatabaseViewClient {...defaultProps} />);
    });

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Try again" }));
    });

    // After retry succeeds, error state should be gone
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("does not show error state when initialData is provided", async () => {
    const propsWithData = {
      ...defaultProps,
      initialData: {
        properties: [],
        views: [],
        rows: [],
      },
    };

    await act(async () => {
      render(<DatabaseViewClient {...propsWithData} />);
    });

    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
    expect(loadDatabaseMock).not.toHaveBeenCalled();
  });

  it("shows loading skeleton before error state", async () => {
    let resolveLoad: (value: unknown) => void;
    const loadPromise = new Promise((resolve) => {
      resolveLoad = resolve;
    });
    loadDatabaseMock.mockReturnValue(loadPromise);

    await act(async () => {
      render(<DatabaseViewClient {...defaultProps} />);
    });

    // Should show skeleton while loading
    expect(screen.getByTestId("database-skeleton")).toBeInTheDocument();

    // Resolve with error
    await act(async () => {
      resolveLoad!({ data: null, error: new Error("fail") });
    });

    // Should now show error state
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.queryByTestId("database-skeleton")).not.toBeInTheDocument();
  });
});
