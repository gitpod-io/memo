import "@testing-library/jest-dom/vitest";
import { render, screen, within, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type {
  DatabaseProperty,
  DatabaseRow,
} from "@/lib/types";
import { CalendarView, type CalendarViewProps } from "./calendar-view";

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

// Mock the Button component to avoid base-ui dependency issues in jsdom
vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    "aria-label": ariaLabel,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    "aria-label"?: string;
    variant?: string;
    size?: string;
    className?: string;
  }) => (
    <button onClick={onClick} aria-label={ariaLabel} {...props}>
      {children}
    </button>
  ),
}));

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeDateProperty(
  overrides: Partial<DatabaseProperty> = {},
): DatabaseProperty {
  return {
    id: "prop-date",
    database_id: "db-1",
    name: "Due Date",
    type: "date",
    config: {},
    position: 0,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeRow(
  id: string,
  title: string,
  dateValue: string | null,
  propertyId = "prop-date",
): DatabaseRow {
  const values: DatabaseRow["values"] = {};
  if (dateValue) {
    values[propertyId] = {
      id: `rv-${id}`,
      row_id: id,
      property_id: propertyId,
      value: { date: dateValue },
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

function defaultProps(
  overrides: Partial<CalendarViewProps> = {},
): CalendarViewProps {
  const dateProp = makeDateProperty();
  return {
    rows: [
      makeRow("row-1", "Task A", "2025-03-10"),
      makeRow("row-2", "Task B", "2025-03-15"),
      makeRow("row-3", "Task C", "2025-03-15"),
    ],
    properties: [dateProp],
    viewConfig: { date_property: "prop-date" },
    workspaceSlug: "ws",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CalendarView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Fix the current date so initial state and "Today" behavior are deterministic.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 2, 20)); // March 20, 2025
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- Grid rendering ---

  it("renders a month grid with correct day headers", () => {
    render(<CalendarView {...defaultProps()} />);

    for (const day of ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) {
      expect(screen.getByRole("columnheader", { name: day })).toBeInTheDocument();
    }

    expect(screen.getByText("March 2025")).toBeInTheDocument();
  });

  // --- Items on correct dates ---

  it("items appear on the correct date cells", () => {
    render(<CalendarView {...defaultProps()} />);

    const march10Cell = screen.getByRole("gridcell", { name: "2025-03-10" });
    expect(within(march10Cell).getByText("Task A")).toBeInTheDocument();

    const march15Cell = screen.getByRole("gridcell", { name: "2025-03-15" });
    expect(within(march15Cell).getByText("Task B")).toBeInTheDocument();
    expect(within(march15Cell).getByText("Task C")).toBeInTheDocument();
  });

  // --- Previous/next month navigation ---

  it("previous month navigation updates the displayed month", () => {
    render(<CalendarView {...defaultProps()} />);

    expect(screen.getByText("March 2025")).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    });

    expect(screen.getByText("February 2025")).toBeInTheDocument();
    expect(screen.queryByText("March 2025")).not.toBeInTheDocument();
  });

  it("next month navigation updates the displayed month", () => {
    render(<CalendarView {...defaultProps()} />);

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    });

    expect(screen.getByText("April 2025")).toBeInTheDocument();
    expect(screen.queryByText("March 2025")).not.toBeInTheDocument();
  });

  // --- Today button ---

  it("'Today' button returns to current month after navigating away", () => {
    render(<CalendarView {...defaultProps()} />);

    // Navigate away
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    });
    expect(screen.getByText("May 2025")).toBeInTheDocument();

    // Click "Today" to return
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Today" }));
    });

    expect(screen.getByText("March 2025")).toBeInTheDocument();
  });

  // --- Items without a date ---

  it("items without a date value are excluded from the grid", () => {
    const dateProp = makeDateProperty();
    const rows = [
      makeRow("row-1", "Has Date", "2025-03-10"),
      makeRow("row-no-date", "No Date Task", null),
    ];

    render(
      <CalendarView
        {...defaultProps({ rows, properties: [dateProp] })}
      />,
    );

    expect(screen.getByText("Has Date")).toBeInTheDocument();
    expect(screen.queryByText("No Date Task")).not.toBeInTheDocument();
  });

  // --- Empty day cells clickable ---

  it("empty day cells are clickable to add a row on that date", () => {
    const onAddRow = vi.fn();
    const dateProp = makeDateProperty();

    render(
      <CalendarView
        {...defaultProps({
          rows: [],
          properties: [dateProp],
          onAddRow,
        })}
      />,
    );

    // Click directly on the March 5 cell (empty, no items)
    const march5Cell = screen.getByRole("gridcell", { name: "2025-03-05" });
    fireEvent.click(march5Cell);

    expect(onAddRow).toHaveBeenCalledWith({
      "prop-date": { date: "2025-03-05" },
    });
  });

  // --- No date property configured ---

  it("shows prompt when no date property is configured", () => {
    render(
      <CalendarView
        {...defaultProps({ viewConfig: {} })}
      />,
    );

    expect(
      screen.getByText("Select a date property to position items on the calendar"),
    ).toBeInTheDocument();
  });

  it("shows prompt to add a date property when none exist", () => {
    render(
      <CalendarView
        {...defaultProps({
          properties: [
            {
              id: "prop-text",
              database_id: "db-1",
              name: "Notes",
              type: "text",
              config: {},
              position: 0,
              created_at: "2025-01-01T00:00:00Z",
              updated_at: "2025-01-01T00:00:00Z",
            },
          ],
          viewConfig: {},
        })}
      />,
    );

    expect(
      screen.getByText("Add a date property to use calendar view"),
    ).toBeInTheDocument();
  });

  // --- Loading state ---

  it("shows skeleton when loading", () => {
    const { container } = render(
      <CalendarView {...defaultProps({ loading: true })} />,
    );

    expect(screen.queryByText("March 2025")).not.toBeInTheDocument();
    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  // --- Year rollover ---

  it("navigating previous from January goes to December of previous year", () => {
    vi.setSystemTime(new Date(2025, 0, 15)); // January 2025

    render(<CalendarView {...defaultProps()} />);

    expect(screen.getByText("January 2025")).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    });

    expect(screen.getByText("December 2024")).toBeInTheDocument();
  });

  it("navigating next from December goes to January of next year", () => {
    vi.setSystemTime(new Date(2025, 11, 15)); // December 2025

    render(<CalendarView {...defaultProps()} />);

    expect(screen.getByText("December 2025")).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    });

    expect(screen.getByText("January 2026")).toBeInTheDocument();
  });

  // --- Item links ---

  it("calendar items link to the correct page URL", () => {
    render(<CalendarView {...defaultProps()} />);

    const link = screen.getByText("Task A").closest("a");
    expect(link).toHaveAttribute("href", "/ws/row-1");
  });

  // --- Grid completeness ---

  it("grid fills complete weeks with overflow days from adjacent months", () => {
    render(<CalendarView {...defaultProps()} />);

    // March 2025 starts on Saturday (day index 6), so there are
    // overflow days from February. Total cells must be a multiple of 7.
    const grid = screen.getByRole("grid");
    const cells = within(grid).getAllByRole("gridcell");
    expect(cells.length % 7).toBe(0);
    expect(cells.length).toBeGreaterThanOrEqual(28);
  });
});
