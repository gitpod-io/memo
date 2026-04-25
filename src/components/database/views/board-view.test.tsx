import "@testing-library/jest-dom/vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  DatabaseProperty,
  DatabaseRow,
  SelectOption,
} from "@/lib/types";
import { BoardView, type BoardViewProps } from "./board-view";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock next/link to render a plain <a>
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock the property-type registry — we only need a minimal Renderer
vi.mock("@/components/database/property-types/index", () => ({
  getPropertyTypeConfig: (type: string) => ({
    Renderer: ({ value }: { value: Record<string, unknown> }) => (
      <span data-testid={`prop-renderer-${type}`}>
        {String(value.text ?? value.option_id ?? "")}
      </span>
    ),
  }),
}));

// Mock formula evaluation — return a display value for formula properties
vi.mock("@/components/database/property-types/formula", () => ({
  evaluateFormulaForRow: () => ({ _display: "formula-result" }),
}));

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

const STATUS_OPTIONS: SelectOption[] = [
  { id: "opt-todo", name: "To Do", color: "blue" },
  { id: "opt-doing", name: "In Progress", color: "yellow" },
  { id: "opt-done", name: "Done", color: "green" },
];

function makeProperty(
  overrides: Partial<DatabaseProperty> = {},
): DatabaseProperty {
  return {
    id: "prop-status",
    database_id: "db-1",
    name: "Status",
    type: "select",
    config: { options: STATUS_OPTIONS },
    position: 0,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeTextProperty(
  overrides: Partial<DatabaseProperty> = {},
): DatabaseProperty {
  return {
    id: "prop-text",
    database_id: "db-1",
    name: "Notes",
    type: "text",
    config: {},
    position: 1,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeRow(
  id: string,
  title: string,
  optionId: string | null,
  propertyId = "prop-status",
  extraValues: Record<string, { id: string; row_id: string; property_id: string; value: Record<string, unknown>; created_at: string; updated_at: string }> = {},
): DatabaseRow {
  const values: DatabaseRow["values"] = { ...extraValues };
  if (optionId) {
    values[propertyId] = {
      id: `rv-${id}`,
      row_id: id,
      property_id: propertyId,
      value: { option_id: optionId },
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };
  }
  return {
    page: {
      id,
      title,
      icon: null,
      cover_url: null,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
      created_by: "user-1",
    },
    values,
  };
}

function defaultProps(overrides: Partial<BoardViewProps> = {}): BoardViewProps {
  const statusProp = makeProperty();
  return {
    rows: [
      makeRow("row-1", "Task A", "opt-todo"),
      makeRow("row-2", "Task B", "opt-doing"),
      makeRow("row-3", "Task C", "opt-done"),
    ],
    properties: [statusProp],
    viewConfig: { group_by: "prop-status" },
    workspaceSlug: "ws",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BoardView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Column grouping ---

  it("renders columns grouped by the selected select property", () => {
    render(<BoardView {...defaultProps()} />);

    // Each option becomes a column, plus the uncategorized column
    expect(screen.getByText("To Do")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("No value")).toBeInTheDocument();
  });

  // --- Card rendering ---

  it("cards display row title", () => {
    render(<BoardView {...defaultProps()} />);

    expect(screen.getByText("Task A")).toBeInTheDocument();
    expect(screen.getByText("Task B")).toBeInTheDocument();
    expect(screen.getByText("Task C")).toBeInTheDocument();
  });

  it("cards display visible properties", () => {
    const statusProp = makeProperty();
    const textProp = makeTextProperty();
    const rows = [
      makeRow("row-1", "Task A", "opt-todo", "prop-status", {
        "prop-text": {
          id: "rv-text-1",
          row_id: "row-1",
          property_id: "prop-text",
          value: { text: "Some notes" },
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        },
      }),
    ];

    render(
      <BoardView
        {...defaultProps({
          rows,
          properties: [statusProp, textProp],
          viewConfig: {
            group_by: "prop-status",
            visible_properties: ["prop-text"],
          },
        })}
      />,
    );

    // The text property renderer should be called with the value
    expect(screen.getByTestId("prop-renderer-text")).toBeInTheDocument();
    expect(screen.getByText("Some notes")).toBeInTheDocument();
  });

  // --- Uncategorized column ---

  it("renders 'No value' column for rows without a value", () => {
    const statusProp = makeProperty();
    const rows = [
      makeRow("row-1", "Task A", "opt-todo"),
      makeRow("row-no-status", "Unassigned Task", null),
    ];

    render(
      <BoardView
        {...defaultProps({ rows, properties: [statusProp] })}
      />,
    );

    const noValueColumn = screen.getByTestId("db-board-column-__uncategorized__");
    expect(within(noValueColumn).getByText("Unassigned Task")).toBeInTheDocument();
  });

  // --- Empty column placeholder ---

  it("empty column shows column header with zero count", () => {
    const statusProp = makeProperty();
    // Only put rows in "To Do" — "In Progress" and "Done" will be empty
    const rows = [makeRow("row-1", "Task A", "opt-todo")];

    render(
      <BoardView
        {...defaultProps({
          rows,
          properties: [statusProp],
          viewConfig: { group_by: "prop-status", hide_empty_groups: false },
        })}
      />,
    );

    // "In Progress" column exists but has 0 cards
    const inProgressColumn = screen.getByTestId("db-board-column-opt-doing");
    expect(within(inProgressColumn).getByText("In Progress")).toBeInTheDocument();
    expect(within(inProgressColumn).getByText("0")).toBeInTheDocument();
  });

  // --- Add-row button ---

  it("add-row button in each column calls the correct callback", async () => {
    const user = userEvent.setup();
    const onAddRow = vi.fn();

    render(<BoardView {...defaultProps({ onAddRow })} />);

    // Click the "+ New" button in the "To Do" column
    const todoColumn = screen.getByTestId("db-board-column-opt-todo");
    const addButton = within(todoColumn).getByRole("button", {
      name: /add card to to do/i,
    });
    await user.click(addButton);

    expect(onAddRow).toHaveBeenCalledWith({
      "prop-status": { option_id: "opt-todo" },
    });
  });

  it("add-row button in uncategorized column calls onAddRow without initial values", async () => {
    const user = userEvent.setup();
    const onAddRow = vi.fn();

    render(<BoardView {...defaultProps({ onAddRow })} />);

    const uncatColumn = screen.getByTestId("db-board-column-__uncategorized__");
    const addButton = within(uncatColumn).getByRole("button", {
      name: /add card to no value/i,
    });
    await user.click(addButton);

    // Uncategorized column calls onAddRow with no initial values
    expect(onAddRow).toHaveBeenCalledWith();
  });

  // --- Drag-and-drop ---

  it("drag-and-drop fires onCardMove with correct source/target data", () => {
    const onCardMove = vi.fn();

    render(<BoardView {...defaultProps({ onCardMove })} />);

    const card = screen.getByTestId("db-board-card-row-1");
    const doneColumn = screen.getByTestId("db-board-column-opt-done");

    // jsdom doesn't support real DataTransfer — provide a mock on the event
    const dataTransfer = {
      effectAllowed: "uninitialized",
      dropEffect: "none",
      setData: vi.fn(),
      getData: vi.fn(),
    };

    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(doneColumn, { dataTransfer });
    fireEvent.drop(doneColumn, { dataTransfer });

    expect(onCardMove).toHaveBeenCalledWith("row-1", "prop-status", "opt-done");
  });

  // --- No group_by configured ---

  it("shows configuration prompt when no group_by property is set", () => {
    render(
      <BoardView
        {...defaultProps({ viewConfig: {} })}
      />,
    );

    expect(
      screen.getByText(/select a .+group by.+ property/i),
    ).toBeInTheDocument();
  });

  // --- Loading state ---

  it("shows skeleton when loading", () => {
    const { container } = render(
      <BoardView {...defaultProps({ loading: true })} />,
    );

    // Skeleton renders animated pulse elements, no real columns
    expect(screen.queryByText("To Do")).not.toBeInTheDocument();
    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  // --- Card links ---

  it("cards link to the correct page URL", () => {
    render(<BoardView {...defaultProps()} />);

    const card = screen.getByTestId("db-board-card-row-1");
    expect(card).toHaveAttribute("href", "/ws/row-1");
  });

  // --- Column count ---

  it("column header shows the correct row count", () => {
    const statusProp = makeProperty();
    const rows = [
      makeRow("row-1", "Task A", "opt-todo"),
      makeRow("row-2", "Task B", "opt-todo"),
      makeRow("row-3", "Task C", "opt-done"),
    ];

    render(
      <BoardView {...defaultProps({ rows, properties: [statusProp] })} />,
    );

    const todoColumn = screen.getByTestId("db-board-column-opt-todo");
    // "To Do" column should show count of 2
    expect(within(todoColumn).getByText("2")).toBeInTheDocument();
  });

  // --- hide_empty_groups ---

  it("hides empty columns when hide_empty_groups is true", () => {
    const statusProp = makeProperty();
    const rows = [makeRow("row-1", "Task A", "opt-todo")];

    render(
      <BoardView
        {...defaultProps({
          rows,
          properties: [statusProp],
          viewConfig: { group_by: "prop-status", hide_empty_groups: true },
        })}
      />,
    );

    // "To Do" should exist, "In Progress" and "Done" should not
    expect(screen.getByText("To Do")).toBeInTheDocument();
    expect(screen.queryByText("In Progress")).not.toBeInTheDocument();
    expect(screen.queryByText("Done")).not.toBeInTheDocument();
  });
});
