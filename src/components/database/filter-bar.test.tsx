import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DatabaseProperty } from "@/lib/types";
import type { FilterRule } from "@/lib/database-filters";
import { FilterBar, type FilterBarProps } from "./filter-bar";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock the DatePicker to avoid calendar rendering complexity in jsdom
vi.mock("./property-types/date", () => ({
  DatePicker: ({
    onSelect,
    onClose,
  }: {
    selectedDate: string | null;
    onSelect: (iso: string) => void;
    onClose: () => void;
  }) => (
    <div data-testid="mock-date-picker">
      <button onClick={() => onSelect("2025-06-15")}>Pick date</button>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock SelectOptionBadge to simplify select option rendering
vi.mock("./property-types/select-option-badge", () => ({
  SelectOptionBadge: ({ name }: { name: string }) => (
    <span data-testid="select-option-badge">{name}</span>
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProperty(
  overrides: Partial<DatabaseProperty> = {},
): DatabaseProperty {
  return {
    id: "prop-text",
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

const textProp = makeProperty({
  id: "prop-text",
  name: "Title",
  type: "text",
});
const numberProp = makeProperty({
  id: "prop-number",
  name: "Amount",
  type: "number",
  position: 1,
});
const selectProp = makeProperty({
  id: "prop-select",
  name: "Status",
  type: "select",
  position: 2,
  config: {
    options: [
      { id: "opt-1", name: "Active", color: "green" },
      { id: "opt-2", name: "Inactive", color: "red" },
    ],
  },
});
const dateProp = makeProperty({
  id: "prop-date",
  name: "Due Date",
  type: "date",
  position: 3,
});
const checkboxProp = makeProperty({
  id: "prop-checkbox",
  name: "Done",
  type: "checkbox",
  position: 4,
});
const urlProp = makeProperty({
  id: "prop-url",
  name: "Website",
  type: "url",
  position: 5,
});
const emailProp = makeProperty({
  id: "prop-email",
  name: "Email",
  type: "email",
  position: 6,
});
const multiSelectProp = makeProperty({
  id: "prop-multi",
  name: "Tags",
  type: "multi_select",
  position: 7,
  config: {
    options: [
      { id: "tag-1", name: "Frontend", color: "blue" },
      { id: "tag-2", name: "Backend", color: "purple" },
    ],
  },
});

const allProperties: DatabaseProperty[] = [
  textProp,
  numberProp,
  selectProp,
  dateProp,
  checkboxProp,
  urlProp,
  emailProp,
  multiSelectProp,
];

function defaultProps(overrides: Partial<FilterBarProps> = {}): FilterBarProps {
  return {
    properties: allProperties,
    filters: [],
    onFiltersChange: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Rendering active filter pills
// ---------------------------------------------------------------------------

describe("FilterBar — active filter pills", () => {
  it("renders a pill for each active filter", () => {
    const filters: FilterRule[] = [
      { property_id: "prop-text", operator: "contains", value: "hello" },
      { property_id: "prop-number", operator: "gt", value: 42 },
    ];
    render(<FilterBar {...defaultProps({ filters })} />);

    expect(screen.getByTestId("db-filter-pill-0")).toHaveTextContent("Title");
    expect(screen.getByTestId("db-filter-pill-0")).toHaveTextContent(
      "contains",
    );
    expect(screen.getByTestId("db-filter-pill-0")).toHaveTextContent("hello");

    expect(screen.getByTestId("db-filter-pill-1")).toHaveTextContent("Amount");
    expect(screen.getByTestId("db-filter-pill-1")).toHaveTextContent(">");
    expect(screen.getByTestId("db-filter-pill-1")).toHaveTextContent("42");
  });

  it("renders pills for select properties with resolved option names", () => {
    const filters: FilterRule[] = [
      { property_id: "prop-select", operator: "equals", value: "opt-1" },
    ];
    render(<FilterBar {...defaultProps({ filters })} />);

    const pill = screen.getByTestId("db-filter-pill-0");
    expect(pill).toHaveTextContent("Status");
    expect(pill).toHaveTextContent("is");
    expect(pill).toHaveTextContent("Active");
  });

  it("renders pills for is_empty operators without a value label", () => {
    const filters: FilterRule[] = [
      { property_id: "prop-text", operator: "is_empty", value: null },
    ];
    render(<FilterBar {...defaultProps({ filters })} />);

    const pill = screen.getByTestId("db-filter-pill-0");
    expect(pill).toHaveTextContent("Title");
    expect(pill).toHaveTextContent("is empty");
  });

  it("renders pills for checkbox operators", () => {
    const filters: FilterRule[] = [
      { property_id: "prop-checkbox", operator: "is_checked", value: null },
    ];
    render(<FilterBar {...defaultProps({ filters })} />);

    const pill = screen.getByTestId("db-filter-pill-0");
    expect(pill).toHaveTextContent("Done");
    expect(pill).toHaveTextContent("is checked");
  });

  it("renders no pills when filters array is empty", () => {
    render(<FilterBar {...defaultProps()} />);
    expect(screen.queryByTestId("db-filter-pill-0")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Removing a filter
// ---------------------------------------------------------------------------

describe("FilterBar — removing a filter", () => {
  it("calls onFiltersChange without the removed filter when X is clicked", async () => {
    const user = userEvent.setup();
    const filters: FilterRule[] = [
      { property_id: "prop-text", operator: "contains", value: "hello" },
      { property_id: "prop-number", operator: "gt", value: 42 },
    ];
    const onFiltersChange = vi.fn();
    render(<FilterBar {...defaultProps({ filters, onFiltersChange })} />);

    const removeBtn = screen.getByLabelText("Remove Title filter");
    await user.click(removeBtn);

    expect(onFiltersChange).toHaveBeenCalledWith([
      { property_id: "prop-number", operator: "gt", value: 42 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Adding a filter via the "Add filter" button
// ---------------------------------------------------------------------------

describe("FilterBar — adding a filter", () => {
  it("opens property picker when 'Add filter' is clicked", async () => {
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps()} />);

    await user.click(screen.getByTestId("db-filter-add"));

    expect(
      screen.getByTestId("db-filter-property-picker"),
    ).toBeInTheDocument();
    // All properties should be listed
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Amount")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("shows operator picker after selecting a property", async () => {
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps()} />);

    await user.click(screen.getByTestId("db-filter-add"));
    await user.click(screen.getByText("Title"));

    expect(
      screen.getByTestId("db-filter-operator-picker"),
    ).toBeInTheDocument();
  });

  it("shows text-appropriate operators for text property", async () => {
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps()} />);

    await user.click(screen.getByTestId("db-filter-add"));
    await user.click(screen.getByText("Title"));

    expect(screen.getByTestId("db-filter-operator-contains")).toBeInTheDocument();
    expect(screen.getByTestId("db-filter-operator-equals")).toBeInTheDocument();
    expect(screen.getByTestId("db-filter-operator-is_empty")).toBeInTheDocument();
    expect(screen.getByTestId("db-filter-operator-is_not_empty")).toBeInTheDocument();
    // Number-only operators should not appear
    expect(screen.queryByTestId("db-filter-operator-gt")).not.toBeInTheDocument();
  });

  it("shows number-appropriate operators for number property", async () => {
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps()} />);

    await user.click(screen.getByTestId("db-filter-add"));
    await user.click(screen.getByText("Amount"));

    expect(screen.getByTestId("db-filter-operator-equals")).toBeInTheDocument();
    expect(screen.getByTestId("db-filter-operator-gt")).toBeInTheDocument();
    expect(screen.getByTestId("db-filter-operator-lt")).toBeInTheDocument();
    expect(screen.getByTestId("db-filter-operator-gte")).toBeInTheDocument();
    expect(screen.getByTestId("db-filter-operator-lte")).toBeInTheDocument();
    // Text-only operators should not appear
    expect(
      screen.queryByTestId("db-filter-operator-contains"),
    ).not.toBeInTheDocument();
  });

  it("shows checkbox-appropriate operators for checkbox property", async () => {
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps()} />);

    await user.click(screen.getByTestId("db-filter-add"));
    await user.click(screen.getByText("Done"));

    expect(
      screen.getByTestId("db-filter-operator-is_checked"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("db-filter-operator-is_not_checked"),
    ).toBeInTheDocument();
    // No other operators
    expect(
      screen.queryByTestId("db-filter-operator-contains"),
    ).not.toBeInTheDocument();
  });

  it("shows date-appropriate operators for date property", async () => {
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps()} />);

    await user.click(screen.getByTestId("db-filter-add"));
    await user.click(screen.getByText("Due Date"));

    expect(screen.getByTestId("db-filter-operator-equals")).toBeInTheDocument();
    expect(screen.getByTestId("db-filter-operator-before")).toBeInTheDocument();
    expect(screen.getByTestId("db-filter-operator-after")).toBeInTheDocument();
  });

  it("adds filter immediately for is_empty operator (no value step)", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    render(<FilterBar {...defaultProps({ onFiltersChange })} />);

    await user.click(screen.getByTestId("db-filter-add"));
    await user.click(screen.getByText("Title"));
    await user.click(screen.getByTestId("db-filter-operator-is_empty"));

    expect(onFiltersChange).toHaveBeenCalledWith([
      { property_id: "prop-text", operator: "is_empty", value: null },
    ]);
    // Dropdown should close
    expect(
      screen.queryByTestId("db-filter-operator-picker"),
    ).not.toBeInTheDocument();
  });

  it("adds filter immediately for is_checked operator (no value step)", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    render(<FilterBar {...defaultProps({ onFiltersChange })} />);

    await user.click(screen.getByTestId("db-filter-add"));
    await user.click(screen.getByText("Done"));
    await user.click(screen.getByTestId("db-filter-operator-is_checked"));

    expect(onFiltersChange).toHaveBeenCalledWith([
      { property_id: "prop-checkbox", operator: "is_checked", value: null },
    ]);
  });

  it("shows value editor for text 'contains' operator and commits on Enter", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    render(<FilterBar {...defaultProps({ onFiltersChange })} />);

    await user.click(screen.getByTestId("db-filter-add"));
    await user.click(screen.getByText("Title"));
    await user.click(screen.getByTestId("db-filter-operator-contains"));

    const input = screen.getByTestId("db-filter-value-input");
    expect(input).toBeInTheDocument();

    await user.type(input, "search term{Enter}");

    expect(onFiltersChange).toHaveBeenCalledWith([
      {
        property_id: "prop-text",
        operator: "contains",
        value: "search term",
      },
    ]);
  });

  it("shows select options for select property and commits on option click", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    render(<FilterBar {...defaultProps({ onFiltersChange })} />);

    await user.click(screen.getByTestId("db-filter-add"));
    await user.click(screen.getByText("Status"));
    await user.click(screen.getByTestId("db-filter-operator-equals"));

    // Select option badges should be visible
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();

    await user.click(screen.getByText("Active"));

    expect(onFiltersChange).toHaveBeenCalledWith([
      { property_id: "prop-select", operator: "equals", value: "opt-1" },
    ]);
  });

  it("shows date picker for date property and commits on date selection", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    render(<FilterBar {...defaultProps({ onFiltersChange })} />);

    await user.click(screen.getByTestId("db-filter-add"));
    await user.click(screen.getByText("Due Date"));
    await user.click(screen.getByTestId("db-filter-operator-equals"));

    expect(screen.getByTestId("mock-date-picker")).toBeInTheDocument();

    await user.click(screen.getByText("Pick date"));

    expect(onFiltersChange).toHaveBeenCalledWith([
      {
        property_id: "prop-date",
        operator: "equals",
        value: "2025-06-15",
      },
    ]);
  });

  it("appends to existing filters when adding a new one", async () => {
    const user = userEvent.setup();
    const existingFilters: FilterRule[] = [
      { property_id: "prop-text", operator: "contains", value: "existing" },
    ];
    const onFiltersChange = vi.fn();
    render(
      <FilterBar
        {...defaultProps({ filters: existingFilters, onFiltersChange })}
      />,
    );

    await user.click(screen.getByTestId("db-filter-add"));
    await user.click(screen.getByText("Amount"));
    await user.click(screen.getByTestId("db-filter-operator-is_empty"));

    expect(onFiltersChange).toHaveBeenCalledWith([
      { property_id: "prop-text", operator: "contains", value: "existing" },
      { property_id: "prop-number", operator: "is_empty", value: null },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Clearing all filters (removing one by one)
// ---------------------------------------------------------------------------

describe("FilterBar — clearing filters", () => {
  it("removes the correct filter when there are multiple", async () => {
    const user = userEvent.setup();
    const filters: FilterRule[] = [
      { property_id: "prop-text", operator: "contains", value: "a" },
      { property_id: "prop-number", operator: "gt", value: 1 },
    ];
    const onFiltersChange = vi.fn();
    render(<FilterBar {...defaultProps({ filters, onFiltersChange })} />);

    // Remove first filter
    await user.click(screen.getByLabelText("Remove Title filter"));
    expect(onFiltersChange).toHaveBeenCalledWith([
      { property_id: "prop-number", operator: "gt", value: 1 },
    ]);
  });

  it("produces an empty array when removing the last filter", async () => {
    const user = userEvent.setup();
    const filters: FilterRule[] = [
      { property_id: "prop-number", operator: "gt", value: 1 },
    ];
    const onFiltersChange = vi.fn();
    render(<FilterBar {...defaultProps({ filters, onFiltersChange })} />);

    await user.click(screen.getByLabelText("Remove Amount filter"));
    expect(onFiltersChange).toHaveBeenCalledWith([]);
  });
});
