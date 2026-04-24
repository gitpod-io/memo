import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DatabaseView } from "@/lib/types";
import { ViewTabs, type ViewTabsProps } from "./view-tabs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeView(overrides: Partial<DatabaseView> = {}): DatabaseView {
  return {
    id: "view-1",
    database_id: "db-1",
    name: "Table View",
    type: "table",
    config: {},
    position: 0,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

const defaultViews: DatabaseView[] = [
  makeView({ id: "view-1", name: "Table View", type: "table", position: 0 }),
  makeView({ id: "view-2", name: "Board View", type: "board", position: 1 }),
  makeView({ id: "view-3", name: "List View", type: "list", position: 2 }),
];

function defaultProps(overrides: Partial<ViewTabsProps> = {}): ViewTabsProps {
  return {
    views: defaultViews,
    activeViewId: "view-1",
    onViewChange: vi.fn(),
    onAddView: vi.fn(),
    onRenameView: vi.fn(),
    onDeleteView: vi.fn(),
    onDuplicateView: vi.fn(),
    onReorderViews: vi.fn(),
    ...overrides,
  };
}

/** Get the tab button for a view by its name text. */
function getTab(name: string) {
  return screen.getByRole("button", { name: new RegExp(name) });
}

// ---------------------------------------------------------------------------
// Tab click → selects view
// ---------------------------------------------------------------------------

describe("ViewTabs — tab click", () => {
  it("calls onViewChange when clicking an inactive tab", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<ViewTabs {...props} />);

    await user.click(getTab("Board View"));
    expect(props.onViewChange).toHaveBeenCalledWith("view-2");
  });

  it("does not call onViewChange when clicking the already-active tab", async () => {
    const user = userEvent.setup();
    const props = defaultProps({ activeViewId: "view-1" });
    render(<ViewTabs {...props} />);

    await user.click(getTab("Table View"));
    expect(props.onViewChange).not.toHaveBeenCalled();
  });

  it("renders all view names", () => {
    render(<ViewTabs {...defaultProps()} />);
    expect(screen.getByText("Table View")).toBeInTheDocument();
    expect(screen.getByText("Board View")).toBeInTheDocument();
    expect(screen.getByText("List View")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Double-click → inline rename
// ---------------------------------------------------------------------------

describe("ViewTabs — inline rename", () => {
  it("enters rename mode on double-click and shows input with current name", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<ViewTabs {...props} />);

    await user.dblClick(getTab("Table View"));

    const input = screen.getByLabelText("Rename view");
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("Table View");
  });

  it("calls onRenameView with new name on Enter", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<ViewTabs {...props} />);

    await user.dblClick(getTab("Table View"));

    const input = screen.getByLabelText("Rename view");
    await user.clear(input);
    await user.type(input, "Renamed{Enter}");

    expect(props.onRenameView).toHaveBeenCalledWith("view-1", "Renamed");
  });

  it("reverts without calling onRenameView on Escape", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<ViewTabs {...props} />);

    await user.dblClick(getTab("Table View"));

    const input = screen.getByLabelText("Rename view");
    await user.clear(input);
    await user.type(input, "Something else{Escape}");

    expect(props.onRenameView).not.toHaveBeenCalled();
    // Input should be gone, original name restored
    expect(screen.queryByLabelText("Rename view")).not.toBeInTheDocument();
    expect(screen.getByText("Table View")).toBeInTheDocument();
  });

  it("does not call onRenameView when name is unchanged", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<ViewTabs {...props} />);

    await user.dblClick(getTab("Table View"));

    const input = screen.getByLabelText("Rename view");
    // Press Enter without changing the name
    await user.type(input, "{Enter}");

    expect(props.onRenameView).not.toHaveBeenCalled();
  });

  it("confirms rename on blur", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<ViewTabs {...props} />);

    await user.dblClick(getTab("Table View"));

    const input = screen.getByLabelText("Rename view");
    await user.clear(input);
    await user.type(input, "Blurred Name");

    // Click elsewhere to blur
    await user.click(document.body);

    expect(props.onRenameView).toHaveBeenCalledWith("view-1", "Blurred Name");
  });

  it("does not enter rename mode when onRenameView is not provided", async () => {
    const user = userEvent.setup();
    const props = defaultProps({ onRenameView: undefined });
    render(<ViewTabs {...props} />);

    await user.dblClick(getTab("Table View"));

    expect(screen.queryByLabelText("Rename view")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Context menu actions
// ---------------------------------------------------------------------------

describe("ViewTabs — context menu", () => {
  it("opens context menu on right-click with Rename, Duplicate, Delete options", async () => {
    const props = defaultProps();
    render(<ViewTabs {...props} />);

    const tab = getTab("Board View");
    // Right-click to open context menu
    fireEvent.contextMenu(tab);

    // Base UI context menu renders items in a portal — wait for them
    const renameItem = await screen.findByText("Rename");
    expect(renameItem).toBeInTheDocument();
    expect(screen.getByText("Duplicate")).toBeInTheDocument();
    expect(screen.getByText("Delete view")).toBeInTheDocument();
  });

  it("context menu Rename enters inline rename mode", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<ViewTabs {...props} />);

    const tab = getTab("Board View");
    fireEvent.contextMenu(tab);

    const renameItem = await screen.findByText("Rename");
    await user.click(renameItem);

    const input = await screen.findByLabelText("Rename view");
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("Board View");
  });

  it("context menu Duplicate calls onDuplicateView", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<ViewTabs {...props} />);

    const tab = getTab("Board View");
    fireEvent.contextMenu(tab);

    const duplicateItem = await screen.findByText("Duplicate");
    await user.click(duplicateItem);

    expect(props.onDuplicateView).toHaveBeenCalledWith("view-2");
  });

  it("context menu Delete opens confirmation dialog", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<ViewTabs {...props} />);

    const tab = getTab("Board View");
    fireEvent.contextMenu(tab);

    const deleteItem = await screen.findByText("Delete view");
    await user.click(deleteItem);

    // The AlertDialog should appear
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/Board View/)).toBeInTheDocument();
  });

  it("delete confirmation calls onDeleteView", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<ViewTabs {...props} />);

    const tab = getTab("Board View");
    fireEvent.contextMenu(tab);

    const deleteItem = await screen.findByText("Delete view");
    await user.click(deleteItem);

    const dialog = await screen.findByRole("alertdialog");
    const confirmBtn = within(dialog).getByRole("button", { name: /delete/i });
    await user.click(confirmBtn);

    expect(props.onDeleteView).toHaveBeenCalledWith("view-2");
  });

  it("delete cancel does not call onDeleteView", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<ViewTabs {...props} />);

    const tab = getTab("Board View");
    fireEvent.contextMenu(tab);

    const deleteItem = await screen.findByText("Delete view");
    await user.click(deleteItem);

    const dialog = await screen.findByRole("alertdialog");
    const cancelBtn = within(dialog).getByRole("button", { name: /cancel/i });
    await user.click(cancelBtn);

    expect(props.onDeleteView).not.toHaveBeenCalled();
  });

  it("delete is disabled when only one view exists", async () => {
    const singleView = [defaultViews[0]];
    const props = defaultProps({ views: singleView });
    render(<ViewTabs {...props} />);

    const tab = getTab("Table View");
    fireEvent.contextMenu(tab);

    const deleteItem = await screen.findByText("Delete view");
    // The menu item should be disabled (aria-disabled)
    expect(deleteItem.closest("[data-disabled]") ?? deleteItem.closest("[aria-disabled]")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Add view button
// ---------------------------------------------------------------------------

describe("ViewTabs — add view", () => {
  it("renders add view button when onAddView is provided", () => {
    render(<ViewTabs {...defaultProps()} />);
    expect(screen.getByLabelText("Add view")).toBeInTheDocument();
  });

  it("does not render add view button when onAddView is not provided", () => {
    render(<ViewTabs {...defaultProps({ onAddView: undefined })} />);
    expect(screen.queryByLabelText("Add view")).not.toBeInTheDocument();
  });

  it("shows view type options when add view button is clicked", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<ViewTabs {...props} />);

    await user.click(screen.getByLabelText("Add view"));

    expect(await screen.findByText("Table view")).toBeInTheDocument();
    expect(screen.getByText("Board view")).toBeInTheDocument();
    expect(screen.getByText("List view")).toBeInTheDocument();
    expect(screen.getByText("Calendar view")).toBeInTheDocument();
    expect(screen.getByText("Gallery view")).toBeInTheDocument();
  });

  it("calls onAddView with the selected type", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<ViewTabs {...props} />);

    await user.click(screen.getByLabelText("Add view"));

    const boardOption = await screen.findByText("Board view");
    await user.click(boardOption);

    expect(props.onAddView).toHaveBeenCalledWith("board");
  });
});

// ---------------------------------------------------------------------------
// Drag-and-drop reorder
// ---------------------------------------------------------------------------

describe("ViewTabs — drag-and-drop reorder", () => {
  it("calls onReorderViews with correct ID order when dragging view-1 to position 2", () => {
    const props = defaultProps();
    render(<ViewTabs {...props} />);

    const tabs = screen.getAllByRole("button").filter((btn) =>
      defaultViews.some((v) => btn.textContent?.includes(v.name)),
    );

    // Find the context menu triggers (draggable elements wrapping the tabs)
    const draggables = screen
      .getAllByText("Table View")
      .map((el) => el.closest("[draggable]"))
      .filter(Boolean) as HTMLElement[];
    const dragSource = draggables[0];

    const dropTargets = screen
      .getAllByText("List View")
      .map((el) => el.closest("[draggable]"))
      .filter(Boolean) as HTMLElement[];
    const dropTarget = dropTargets[0];

    // Simulate drag-and-drop
    fireEvent.dragStart(dragSource, {
      dataTransfer: { effectAllowed: "move", setData: vi.fn() },
    });
    fireEvent.dragOver(dropTarget, {
      dataTransfer: { dropEffect: "move" },
      preventDefault: vi.fn(),
    });
    fireEvent.drop(dropTarget, {
      dataTransfer: { dropEffect: "move" },
      preventDefault: vi.fn(),
    });

    // view-1 moved from index 0 to index 2 (before view-3)
    // The reorder logic: remove view-1 from [view-1, view-2, view-3]
    // targetIndex=2, currentIndex=0, insertIndex = 2-1 = 1
    // Result: [view-2, view-1, view-3]
    expect(props.onReorderViews).toHaveBeenCalledWith([
      "view-2",
      "view-1",
      "view-3",
    ]);
  });

  it("does not call onReorderViews when dropping on the same position", () => {
    const props = defaultProps();
    render(<ViewTabs {...props} />);

    const draggables = screen
      .getAllByText("Table View")
      .map((el) => el.closest("[draggable]"))
      .filter(Boolean) as HTMLElement[];
    const dragSource = draggables[0];

    fireEvent.dragStart(dragSource, {
      dataTransfer: { effectAllowed: "move", setData: vi.fn() },
    });
    fireEvent.dragOver(dragSource, {
      dataTransfer: { dropEffect: "move" },
      preventDefault: vi.fn(),
    });
    fireEvent.drop(dragSource, {
      dataTransfer: { dropEffect: "move" },
      preventDefault: vi.fn(),
    });

    expect(props.onReorderViews).not.toHaveBeenCalled();
  });

  it("does not render drag handles when onReorderViews is not provided", () => {
    render(<ViewTabs {...defaultProps({ onReorderViews: undefined })} />);

    // Without onReorderViews, tabs should not be draggable
    const draggables = document.querySelectorAll("[draggable='true']");
    expect(draggables.length).toBe(0);
  });

  it("cleans up drag state on dragEnd", () => {
    const props = defaultProps();
    render(<ViewTabs {...props} />);

    const draggables = screen
      .getAllByText("Table View")
      .map((el) => el.closest("[draggable]"))
      .filter(Boolean) as HTMLElement[];
    const dragSource = draggables[0];

    fireEvent.dragStart(dragSource, {
      dataTransfer: { effectAllowed: "move", setData: vi.fn() },
    });
    fireEvent.dragEnd(dragSource);

    // After dragEnd, no drop indicators should be visible and opacity should reset.
    // Verify by attempting a drop — it should not call onReorderViews since
    // dragViewId was cleared.
    const dropTargets = screen
      .getAllByText("Board View")
      .map((el) => el.closest("[draggable]"))
      .filter(Boolean) as HTMLElement[];

    fireEvent.drop(dropTargets[0], {
      dataTransfer: { dropEffect: "move" },
      preventDefault: vi.fn(),
    });

    expect(props.onReorderViews).not.toHaveBeenCalled();
  });
});
