import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import type { DatabaseProperty } from "@/lib/types";
import type { SortRule } from "@/lib/database-filters";
import { SortMenu, type SortMenuProps } from "./sort-menu";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProperty(
  overrides: Partial<DatabaseProperty> = {},
): DatabaseProperty {
  return {
    id: "prop-1",
    database_id: "db-1",
    name: "Title",
    type: "text",
    config: {},
    position: 0,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

const textProp = makeProperty({ id: "prop-text", name: "Title", type: "text" });
const numberProp = makeProperty({
  id: "prop-number",
  name: "Amount",
  type: "number",
  position: 1,
});
const dateProp = makeProperty({
  id: "prop-date",
  name: "Due Date",
  type: "date",
  position: 2,
});
const selectProp = makeProperty({
  id: "prop-select",
  name: "Status",
  type: "select",
  position: 3,
});

const allProperties: DatabaseProperty[] = [
  textProp,
  numberProp,
  dateProp,
  selectProp,
];

function defaultProps(overrides: Partial<SortMenuProps> = {}): SortMenuProps {
  return {
    properties: allProperties,
    sorts: [],
    onSortsChange: vi.fn(),
    ...overrides,
  };
}

/** Open the sort menu by clicking the Sort button. */
async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId("db-sort-button"));
}

// ---------------------------------------------------------------------------
// Rendering sort rules list
// ---------------------------------------------------------------------------

describe("SortMenu — rendering sort rules", () => {
  it("shows 'No sorts applied' when sorts array is empty", async () => {
    const user = userEvent.setup();
    render(<SortMenu {...defaultProps()} />);

    await openMenu(user);

    expect(screen.getByText("No sorts applied")).toBeInTheDocument();
  });

  it("renders each sort rule with property name and direction", async () => {
    const user = userEvent.setup();
    const sorts: SortRule[] = [
      { property_id: "prop-text", direction: "asc" },
      { property_id: "prop-number", direction: "desc" },
    ];
    render(<SortMenu {...defaultProps({ sorts })} />);

    await openMenu(user);

    const rule0 = screen.getByTestId("db-sort-rule-0");
    expect(rule0).toHaveTextContent("Title");
    expect(rule0).toHaveTextContent("Asc");

    const rule1 = screen.getByTestId("db-sort-rule-1");
    expect(rule1).toHaveTextContent("Amount");
    expect(rule1).toHaveTextContent("Desc");
  });

  it("shows sort count in the button when sorts are active", () => {
    const sorts: SortRule[] = [
      { property_id: "prop-text", direction: "asc" },
      { property_id: "prop-number", direction: "desc" },
    ];
    render(<SortMenu {...defaultProps({ sorts })} />);

    expect(screen.getByTestId("db-sort-button")).toHaveTextContent("(2)");
  });

  it("does not show count when no sorts are active", () => {
    render(<SortMenu {...defaultProps()} />);

    const button = screen.getByTestId("db-sort-button");
    expect(button).toHaveTextContent("Sort");
    expect(button).not.toHaveTextContent("(");
  });
});

// ---------------------------------------------------------------------------
// Adding a sort rule
// ---------------------------------------------------------------------------

describe("SortMenu — adding a sort rule", () => {
  it("shows 'Add sort' button when menu is open and properties are available", async () => {
    const user = userEvent.setup();
    render(<SortMenu {...defaultProps()} />);

    await openMenu(user);

    expect(screen.getByText("Add sort")).toBeInTheDocument();
  });

  it("shows property picker when 'Add sort' is clicked", async () => {
    const user = userEvent.setup();
    render(<SortMenu {...defaultProps()} />);

    await openMenu(user);
    await user.click(screen.getByText("Add sort"));

    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Amount")).toBeInTheDocument();
    expect(screen.getByText("Due Date")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("calls onSortsChange with new sort rule when property is selected", async () => {
    const user = userEvent.setup();
    const onSortsChange = vi.fn();
    render(<SortMenu {...defaultProps({ onSortsChange })} />);

    await openMenu(user);
    await user.click(screen.getByText("Add sort"));
    await user.click(screen.getByText("Amount"));

    expect(onSortsChange).toHaveBeenCalledWith([
      { property_id: "prop-number", direction: "asc" },
    ]);
  });

  it("appends to existing sorts when adding a new one", async () => {
    const user = userEvent.setup();
    const existingSorts: SortRule[] = [
      { property_id: "prop-text", direction: "asc" },
    ];
    const onSortsChange = vi.fn();
    render(
      <SortMenu {...defaultProps({ sorts: existingSorts, onSortsChange })} />,
    );

    await openMenu(user);
    await user.click(screen.getByText("Add sort"));
    await user.click(screen.getByText("Due Date"));

    expect(onSortsChange).toHaveBeenCalledWith([
      { property_id: "prop-text", direction: "asc" },
      { property_id: "prop-date", direction: "asc" },
    ]);
  });

  it("excludes already-sorted properties from the picker", async () => {
    const user = userEvent.setup();
    const sorts: SortRule[] = [
      { property_id: "prop-text", direction: "asc" },
    ];
    render(<SortMenu {...defaultProps({ sorts })} />);

    await openMenu(user);
    await user.click(screen.getByText("Add sort"));

    // Title is already sorted, should not appear in picker
    // But it appears in the sort rules list above — query only the picker area
    const buttons = screen.getAllByRole("button");
    const pickerButtons = buttons.filter(
      (btn) =>
        btn.textContent?.includes("Amount") ||
        btn.textContent?.includes("Due Date") ||
        btn.textContent?.includes("Status"),
    );
    expect(pickerButtons.length).toBeGreaterThanOrEqual(3);

    // Title should only appear in the sort rule, not as a pickable option
    // The sort rule shows "Title" + "Asc", the picker should not have a standalone "Title" button
    const titleButtons = buttons.filter(
      (btn) =>
        btn.textContent === "Title" &&
        !btn.textContent?.includes("Asc"),
    );
    expect(titleButtons).toHaveLength(0);
  });

  it("hides 'Add sort' when all properties are already sorted", async () => {
    const user = userEvent.setup();
    const sorts: SortRule[] = allProperties.map((p) => ({
      property_id: p.id,
      direction: "asc" as const,
    }));
    render(<SortMenu {...defaultProps({ sorts })} />);

    await openMenu(user);

    expect(screen.queryByText("Add sort")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Removing a sort rule
// ---------------------------------------------------------------------------

describe("SortMenu — removing a sort rule", () => {
  it("calls onSortsChange without the removed sort", async () => {
    const user = userEvent.setup();
    const sorts: SortRule[] = [
      { property_id: "prop-text", direction: "asc" },
      { property_id: "prop-number", direction: "desc" },
    ];
    const onSortsChange = vi.fn();
    render(<SortMenu {...defaultProps({ sorts, onSortsChange })} />);

    await openMenu(user);

    await user.click(screen.getByLabelText("Remove Title sort"));

    expect(onSortsChange).toHaveBeenCalledWith([
      { property_id: "prop-number", direction: "desc" },
    ]);
  });

  it("produces empty array when removing the last sort", async () => {
    const user = userEvent.setup();
    const sorts: SortRule[] = [
      { property_id: "prop-text", direction: "asc" },
    ];
    const onSortsChange = vi.fn();
    render(<SortMenu {...defaultProps({ sorts, onSortsChange })} />);

    await openMenu(user);

    await user.click(screen.getByLabelText("Remove Title sort"));

    expect(onSortsChange).toHaveBeenCalledWith([]);
  });
});

// ---------------------------------------------------------------------------
// Toggling sort direction
// ---------------------------------------------------------------------------

describe("SortMenu — toggling sort direction", () => {
  it("toggles from asc to desc when direction button is clicked", async () => {
    const user = userEvent.setup();
    const sorts: SortRule[] = [
      { property_id: "prop-text", direction: "asc" },
    ];
    const onSortsChange = vi.fn();
    render(<SortMenu {...defaultProps({ sorts, onSortsChange })} />);

    await openMenu(user);

    await user.click(screen.getByTestId("db-sort-direction-0"));

    expect(onSortsChange).toHaveBeenCalledWith([
      { property_id: "prop-text", direction: "desc" },
    ]);
  });

  it("toggles from desc to asc when direction button is clicked", async () => {
    const user = userEvent.setup();
    const sorts: SortRule[] = [
      { property_id: "prop-text", direction: "desc" },
    ];
    const onSortsChange = vi.fn();
    render(<SortMenu {...defaultProps({ sorts, onSortsChange })} />);

    await openMenu(user);

    await user.click(screen.getByTestId("db-sort-direction-0"));

    expect(onSortsChange).toHaveBeenCalledWith([
      { property_id: "prop-text", direction: "asc" },
    ]);
  });

  it("only toggles the targeted sort rule, leaving others unchanged", async () => {
    const user = userEvent.setup();
    const sorts: SortRule[] = [
      { property_id: "prop-text", direction: "asc" },
      { property_id: "prop-number", direction: "desc" },
    ];
    const onSortsChange = vi.fn();
    render(<SortMenu {...defaultProps({ sorts, onSortsChange })} />);

    await openMenu(user);

    await user.click(screen.getByTestId("db-sort-direction-1"));

    expect(onSortsChange).toHaveBeenCalledWith([
      { property_id: "prop-text", direction: "asc" },
      { property_id: "prop-number", direction: "asc" },
    ]);
  });

  it("displays correct direction label (Asc/Desc)", async () => {
    const user = userEvent.setup();
    const sorts: SortRule[] = [
      { property_id: "prop-text", direction: "asc" },
      { property_id: "prop-number", direction: "desc" },
    ];
    render(<SortMenu {...defaultProps({ sorts })} />);

    await openMenu(user);

    expect(screen.getByTestId("db-sort-direction-0")).toHaveTextContent("Asc");
    expect(screen.getByTestId("db-sort-direction-1")).toHaveTextContent("Desc");
  });

  it("has correct aria-label for direction button", async () => {
    const user = userEvent.setup();
    const sorts: SortRule[] = [
      { property_id: "prop-text", direction: "asc" },
    ];
    render(<SortMenu {...defaultProps({ sorts })} />);

    await openMenu(user);

    expect(screen.getByTestId("db-sort-direction-0")).toHaveAttribute(
      "aria-label",
      "Sort ascending",
    );
  });
});

// ---------------------------------------------------------------------------
// Menu open/close behavior
// ---------------------------------------------------------------------------

describe("SortMenu — menu toggle", () => {
  it("opens menu on button click", async () => {
    const user = userEvent.setup();
    render(<SortMenu {...defaultProps()} />);

    expect(screen.queryByTestId("db-sort-menu")).not.toBeInTheDocument();

    await openMenu(user);

    expect(screen.getByTestId("db-sort-menu")).toBeInTheDocument();
  });

  it("closes menu on second button click", async () => {
    const user = userEvent.setup();
    render(<SortMenu {...defaultProps()} />);

    await openMenu(user);
    expect(screen.getByTestId("db-sort-menu")).toBeInTheDocument();

    await user.click(screen.getByTestId("db-sort-button"));
    expect(screen.queryByTestId("db-sort-menu")).not.toBeInTheDocument();
  });
});
