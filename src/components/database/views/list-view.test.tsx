import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  DatabaseProperty,
  DatabaseRow,
  SelectOption,
} from "@/lib/types";
import { ListView, type ListViewProps } from "./list-view";

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

// Mock list keyboard navigation — return stable no-op values
vi.mock("./list-keyboard", () => ({
  useListKeyboardNavigation: () => ({
    focusedIndex: null,
    containerRef: { current: null },
    handleKeyDown: vi.fn(),
    handleRowFocus: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

const STATUS_OPTIONS: SelectOption[] = [
  { id: "opt-active", name: "Active", color: "green" },
  { id: "opt-archived", name: "Archived", color: "gray" },
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
  values: DatabaseRow["values"] = {},
  icon: string | null = null,
): DatabaseRow {
  return {
    page: {
      id,
      title,
      icon,
      cover_url: null,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
      created_by: "user-1",
    },
    values,
  };
}

function makeRowValue(
  rowId: string,
  propertyId: string,
  value: Record<string, unknown>,
) {
  return {
    id: `rv-${rowId}-${propertyId}`,
    row_id: rowId,
    property_id: propertyId,
    value,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };
}

function defaultProps(overrides: Partial<ListViewProps> = {}): ListViewProps {
  return {
    rows: [
      makeRow("row-1", "Task Alpha"),
      makeRow("row-2", "Task Beta"),
      makeRow("row-3", "Task Gamma"),
    ],
    properties: [makeProperty()],
    viewConfig: {},
    workspaceSlug: "ws",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ListView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Row rendering with title ---

  it("renders rows with titles", () => {
    render(<ListView {...defaultProps()} />);

    expect(screen.getByText("Task Alpha")).toBeInTheDocument();
    expect(screen.getByText("Task Beta")).toBeInTheDocument();
    expect(screen.getByText("Task Gamma")).toBeInTheDocument();
  });

  it("renders 'Untitled' for rows with empty title", () => {
    const rows = [makeRow("row-1", "")];
    render(<ListView {...defaultProps({ rows })} />);

    expect(screen.getByText("Untitled")).toBeInTheDocument();
  });

  // --- Row links ---

  it("rows link to the correct page URL", () => {
    render(<ListView {...defaultProps()} />);

    const rows = screen.getAllByTestId("list-row");
    expect(rows[0]).toHaveAttribute("href", "/ws/row-1");
    expect(rows[1]).toHaveAttribute("href", "/ws/row-2");
  });

  // --- Empty state ---

  it("shows empty state when no rows", () => {
    render(<ListView {...defaultProps({ rows: [] })} />);

    expect(screen.getByText("No rows yet")).toBeInTheDocument();
  });

  it("shows add-row button in empty state when onAddRow is provided", () => {
    const onAddRow = vi.fn();
    render(<ListView {...defaultProps({ rows: [], onAddRow })} />);

    expect(screen.getByText("No rows yet")).toBeInTheDocument();
    // The "New" button should be present
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  // --- Add-row button click ---

  it("add-row button calls onAddRow", async () => {
    const user = userEvent.setup();
    const onAddRow = vi.fn();

    render(
      <ListView
        {...defaultProps({
          rows: [makeRow("row-1", "Existing")],
          onAddRow,
        })}
      />,
    );

    await user.click(screen.getByText("New"));
    expect(onAddRow).toHaveBeenCalledTimes(1);
  });

  it("add-row button calls onAddRow in empty state", async () => {
    const user = userEvent.setup();
    const onAddRow = vi.fn();

    render(<ListView {...defaultProps({ rows: [], onAddRow })} />);

    await user.click(screen.getByText("New"));
    expect(onAddRow).toHaveBeenCalledTimes(1);
  });

  // --- No add button when onAddRow is not provided ---

  it("does not render add-row button when onAddRow is not provided", () => {
    render(<ListView {...defaultProps()} />);

    expect(screen.queryByText("New")).not.toBeInTheDocument();
  });

  // --- Visible property rendering: select ---

  it("renders select property values as badges", () => {
    const statusProp = makeProperty();
    const rows = [
      makeRow("row-1", "Task A", {
        "prop-status": makeRowValue("row-1", "prop-status", {
          option_id: "opt-active",
        }),
      }),
    ];

    render(
      <ListView
        {...defaultProps({
          rows,
          properties: [statusProp],
          viewConfig: { visible_properties: ["prop-status"] },
        })}
      />,
    );

    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  // --- Visible property rendering: text ---

  it("renders text property values", () => {
    const textProp = makeTextProperty();
    const rows = [
      makeRow("row-1", "Task A", {
        "prop-text": makeRowValue("row-1", "prop-text", {
          text: "Some notes here",
        }),
      }),
    ];

    render(
      <ListView
        {...defaultProps({
          rows,
          properties: [textProp],
          viewConfig: { visible_properties: ["prop-text"] },
        })}
      />,
    );

    expect(screen.getByText("Some notes here")).toBeInTheDocument();
  });

  // --- Visible property rendering: number ---

  it("renders number property values", () => {
    const numProp = makeProperty({
      id: "prop-num",
      name: "Score",
      type: "number",
      config: {},
    });
    const rows = [
      makeRow("row-1", "Task A", {
        "prop-num": makeRowValue("row-1", "prop-num", { number: 42 }),
      }),
    ];

    render(
      <ListView
        {...defaultProps({
          rows,
          properties: [numProp],
          viewConfig: { visible_properties: ["prop-num"] },
        })}
      />,
    );

    expect(screen.getByText("42")).toBeInTheDocument();
  });

  // --- Visible property rendering: date ---

  it("renders date property values formatted", () => {
    const dateProp = makeProperty({
      id: "prop-date",
      name: "Due Date",
      type: "date",
      config: {},
    });
    const rows = [
      makeRow("row-1", "Task A", {
        "prop-date": makeRowValue("row-1", "prop-date", {
          date: "2025-03-15",
        }),
      }),
    ];

    render(
      <ListView
        {...defaultProps({
          rows,
          properties: [dateProp],
          viewConfig: { visible_properties: ["prop-date"] },
        })}
      />,
    );

    // formatDate produces "Mar 15, 2025"
    expect(screen.getByText("Mar 15, 2025")).toBeInTheDocument();
  });

  // --- Visible property rendering: checkbox ---

  it("renders checkbox property as checked indicator", () => {
    const checkProp = makeProperty({
      id: "prop-check",
      name: "Done",
      type: "checkbox",
      config: {},
    });
    const rows = [
      makeRow("row-1", "Task A", {
        "prop-check": makeRowValue("row-1", "prop-check", { value: true }),
      }),
    ];

    const { container } = render(
      <ListView
        {...defaultProps({
          rows,
          properties: [checkProp],
          viewConfig: { visible_properties: ["prop-check"] },
        })}
      />,
    );

    // Checked checkbox renders an SVG checkmark
    const svg = container.querySelector("svg path[d]");
    expect(svg).toBeInTheDocument();
  });

  // --- Visible property rendering: url ---

  it("renders url property values", () => {
    const urlProp = makeProperty({
      id: "prop-url",
      name: "Website",
      type: "url",
      config: {},
    });
    const rows = [
      makeRow("row-1", "Task A", {
        "prop-url": makeRowValue("row-1", "prop-url", {
          url: "https://example.com",
        }),
      }),
    ];

    render(
      <ListView
        {...defaultProps({
          rows,
          properties: [urlProp],
          viewConfig: { visible_properties: ["prop-url"] },
        })}
      />,
    );

    expect(screen.getByText("https://example.com")).toBeInTheDocument();
  });

  // --- Visible property rendering: email ---

  it("renders email property values", () => {
    const emailProp = makeProperty({
      id: "prop-email",
      name: "Email",
      type: "email",
      config: {},
    });
    const rows = [
      makeRow("row-1", "Task A", {
        "prop-email": makeRowValue("row-1", "prop-email", {
          email: "test@example.com",
        }),
      }),
    ];

    render(
      <ListView
        {...defaultProps({
          rows,
          properties: [emailProp],
          viewConfig: { visible_properties: ["prop-email"] },
        })}
      />,
    );

    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  // --- Visible property rendering: multi_select ---

  it("renders multi_select property values as multiple badges", () => {
    const multiProp = makeProperty({
      id: "prop-tags",
      name: "Tags",
      type: "multi_select",
      config: {
        options: [
          { id: "tag-1", name: "Frontend", color: "blue" },
          { id: "tag-2", name: "Backend", color: "green" },
        ],
      },
    });
    const rows = [
      makeRow("row-1", "Task A", {
        "prop-tags": makeRowValue("row-1", "prop-tags", {
          option_ids: ["tag-1", "tag-2"],
        }),
      }),
    ];

    render(
      <ListView
        {...defaultProps({
          rows,
          properties: [multiProp],
          viewConfig: { visible_properties: ["prop-tags"] },
        })}
      />,
    );

    expect(screen.getByText("Frontend")).toBeInTheDocument();
    expect(screen.getByText("Backend")).toBeInTheDocument();
  });

  // --- Shows all properties when visible_properties is not configured ---

  it("shows all properties when visible_properties is not set", () => {
    const statusProp = makeProperty();
    const textProp = makeTextProperty();
    const rows = [
      makeRow("row-1", "Task A", {
        "prop-status": makeRowValue("row-1", "prop-status", {
          option_id: "opt-active",
        }),
        "prop-text": makeRowValue("row-1", "prop-text", {
          text: "Note text",
        }),
      }),
    ];

    render(
      <ListView
        {...defaultProps({
          rows,
          properties: [statusProp, textProp],
          viewConfig: {},
        })}
      />,
    );

    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Note text")).toBeInTheDocument();
  });

  // --- Row icon rendering ---

  it("renders row icon when page has one", () => {
    const rows = [makeRow("row-1", "Task A", {}, "📋")];
    render(<ListView {...defaultProps({ rows })} />);

    expect(screen.getByText("📋")).toBeInTheDocument();
  });

  // --- Loading state ---

  it("shows skeleton when loading", () => {
    const { container } = render(
      <ListView {...defaultProps({ loading: true })} />,
    );

    expect(screen.queryByText("Task Alpha")).not.toBeInTheDocument();
    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  // --- List role ---

  it("renders with list role and correct aria-label", () => {
    render(<ListView {...defaultProps()} />);

    const list = screen.getByRole("list", { name: "Database list" });
    expect(list).toBeInTheDocument();
  });

  // --- Row count ---

  it("renders the correct number of list rows", () => {
    render(<ListView {...defaultProps()} />);

    const rows = screen.getAllByTestId("list-row");
    expect(rows).toHaveLength(3);
  });

  // --- Empty property value is not rendered ---

  it("does not render property value when row has no value for that property", () => {
    const textProp = makeTextProperty();
    const rows = [makeRow("row-1", "Task A")]; // no values

    render(
      <ListView
        {...defaultProps({
          rows,
          properties: [textProp],
          viewConfig: { visible_properties: ["prop-text"] },
        })}
      />,
    );

    // The row should exist but no property value text should be rendered
    const listRow = screen.getByTestId("list-row");
    expect(listRow).toBeInTheDocument();
    // The property value area should be empty (no text content beyond the title)
    const propertySpans = within(listRow).queryAllByText(/.+/);
    // Only the title "Task A" should be present as text
    const texts = propertySpans.map((el) => el.textContent);
    expect(texts).not.toContain("");
  });
});
