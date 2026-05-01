import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import type { DatabaseProperty } from "@/lib/types";
import {
  FilterValueEditor,
  PropertyPicker,
  OperatorPicker,
  getSelectOptions,
  type FilterValueEditorProps,
} from "./filter-value-editor";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock DatePicker to avoid calendar rendering in jsdom
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
      <button onClick={onClose}>Close date</button>
    </div>
  ),
}));

// Mock SelectOptionBadge
vi.mock("./property-types/select-option-badge", () => ({
  SelectOptionBadge: ({ name }: { name: string }) => (
    <span data-testid="db-select-option-badge">{name}</span>
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProperty(
  overrides: Partial<DatabaseProperty> = {},
): DatabaseProperty {
  return {
    id: "prop-1",
    database_id: "db-1",
    name: "Test Prop",
    type: "text",
    config: {},
    position: 0,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function defaultEditorProps(
  overrides: Partial<FilterValueEditorProps> = {},
): FilterValueEditorProps {
  return {
    property: makeProperty(),
    valueInput: "",
    onValueInputChange: vi.fn(),
    onSubmit: vi.fn(),
    onSelectValue: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getSelectOptions helper
// ---------------------------------------------------------------------------

describe("getSelectOptions", () => {
  it("returns options array from config", () => {
    const config = {
      options: [
        { id: "opt-1", name: "Active", color: "green" },
        { id: "opt-2", name: "Inactive", color: "red" },
      ],
    };
    const result = getSelectOptions(config);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Active");
  });

  it("returns empty array when config has no options", () => {
    expect(getSelectOptions({})).toEqual([]);
  });

  it("returns empty array when options is not an array", () => {
    expect(getSelectOptions({ options: "invalid" })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// FilterValueEditor — text/number/URL/email/phone input rendering
// ---------------------------------------------------------------------------

describe("FilterValueEditor — text input types", () => {
  it("renders a text input for text property", () => {
    render(<FilterValueEditor {...defaultEditorProps()} />);

    const input = screen.getByTestId("db-filter-value-input");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveAttribute("placeholder", "Enter value…");
  });

  it("renders a text input for url property", () => {
    render(
      <FilterValueEditor
        {...defaultEditorProps({
          property: makeProperty({ type: "url", name: "Website" }),
        })}
      />,
    );

    const input = screen.getByTestId("db-filter-value-input");
    expect(input).toHaveAttribute("type", "text");
  });

  it("renders a text input for email property", () => {
    render(
      <FilterValueEditor
        {...defaultEditorProps({
          property: makeProperty({ type: "email", name: "Email" }),
        })}
      />,
    );

    const input = screen.getByTestId("db-filter-value-input");
    expect(input).toHaveAttribute("type", "text");
  });

  it("renders a text input for phone property", () => {
    render(
      <FilterValueEditor
        {...defaultEditorProps({
          property: makeProperty({ type: "phone", name: "Phone" }),
        })}
      />,
    );

    const input = screen.getByTestId("db-filter-value-input");
    expect(input).toHaveAttribute("type", "text");
  });

  it("renders a number input for number property", () => {
    render(
      <FilterValueEditor
        {...defaultEditorProps({
          property: makeProperty({ type: "number", name: "Amount" }),
        })}
      />,
    );

    const input = screen.getByTestId("db-filter-value-input");
    expect(input).toHaveAttribute("type", "number");
    expect(input).toHaveAttribute("placeholder", "Enter number…");
  });

  it("displays the current valueInput", () => {
    render(
      <FilterValueEditor
        {...defaultEditorProps({ valueInput: "hello world" })}
      />,
    );

    const input = screen.getByTestId("db-filter-value-input");
    expect(input).toHaveValue("hello world");
  });

  it("calls onValueInputChange when typing", async () => {
    const user = userEvent.setup();
    const onValueInputChange = vi.fn();
    render(
      <FilterValueEditor
        {...defaultEditorProps({ onValueInputChange })}
      />,
    );

    const input = screen.getByTestId("db-filter-value-input");
    await user.type(input, "a");

    expect(onValueInputChange).toHaveBeenCalled();
  });

  it("calls onSubmit when Enter is pressed", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <FilterValueEditor
        {...defaultEditorProps({ onSubmit, valueInput: "test" })}
      />,
    );

    const input = screen.getByTestId("db-filter-value-input");
    await user.type(input, "{Enter}");

    expect(onSubmit).toHaveBeenCalled();
  });

  it("calls onClose when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <FilterValueEditor {...defaultEditorProps({ onClose })} />,
    );

    const input = screen.getByTestId("db-filter-value-input");
    await user.type(input, "{Escape}");

    expect(onClose).toHaveBeenCalled();
  });

  it("calls onSubmit when Apply button is clicked", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <FilterValueEditor
        {...defaultEditorProps({ onSubmit, valueInput: "test" })}
      />,
    );

    await user.click(screen.getByText("Apply"));
    expect(onSubmit).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// FilterValueEditor — select/multi_select dropdown rendering
// ---------------------------------------------------------------------------

describe("FilterValueEditor — select dropdown", () => {
  const selectProperty = makeProperty({
    type: "select",
    name: "Priority",
    config: {
      options: [
        { id: "opt-high", name: "High", color: "red" },
        { id: "opt-med", name: "Medium", color: "yellow" },
        { id: "opt-low", name: "Low", color: "green" },
      ],
    },
  });

  it("renders select options from property config", () => {
    render(
      <FilterValueEditor
        {...defaultEditorProps({ property: selectProperty })}
      />,
    );

    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("Low")).toBeInTheDocument();
  });

  it("calls onSelectValue with option id when an option is clicked", async () => {
    const user = userEvent.setup();
    const onSelectValue = vi.fn();
    render(
      <FilterValueEditor
        {...defaultEditorProps({ property: selectProperty, onSelectValue })}
      />,
    );

    await user.click(screen.getByText("High"));
    expect(onSelectValue).toHaveBeenCalledWith("opt-high");
  });

  it("filters options by search query", async () => {
    const user = userEvent.setup();
    render(
      <FilterValueEditor
        {...defaultEditorProps({ property: selectProperty })}
      />,
    );

    const searchInput = screen.getByPlaceholderText("Search options…");
    await user.type(searchInput, "med");

    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.queryByText("High")).not.toBeInTheDocument();
    expect(screen.queryByText("Low")).not.toBeInTheDocument();
  });

  it("shows 'No options' when search matches nothing", async () => {
    const user = userEvent.setup();
    render(
      <FilterValueEditor
        {...defaultEditorProps({ property: selectProperty })}
      />,
    );

    const searchInput = screen.getByPlaceholderText("Search options…");
    await user.type(searchInput, "zzz");

    expect(screen.getByText("No options")).toBeInTheDocument();
  });

  it("renders multi_select options the same way", () => {
    const multiProp = makeProperty({
      type: "multi_select",
      name: "Tags",
      config: {
        options: [
          { id: "tag-1", name: "Frontend", color: "blue" },
          { id: "tag-2", name: "Backend", color: "purple" },
        ],
      },
    });
    render(
      <FilterValueEditor
        {...defaultEditorProps({ property: multiProp })}
      />,
    );

    expect(screen.getByText("Frontend")).toBeInTheDocument();
    expect(screen.getByText("Backend")).toBeInTheDocument();
  });

  it("renders status options the same way as select", () => {
    const statusProp = makeProperty({
      type: "status",
      name: "Status",
      config: {
        options: [
          { id: "s-1", name: "Not Started", color: "gray" },
          { id: "s-2", name: "In Progress", color: "blue" },
        ],
      },
    });
    render(
      <FilterValueEditor
        {...defaultEditorProps({ property: statusProp })}
      />,
    );

    expect(screen.getByText("Not Started")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
  });

  it("closes select dropdown on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <FilterValueEditor
        {...defaultEditorProps({ property: selectProperty, onClose })}
      />,
    );

    const searchInput = screen.getByPlaceholderText("Search options…");
    await user.type(searchInput, "{Escape}");

    expect(onClose).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// FilterValueEditor — date picker rendering
// ---------------------------------------------------------------------------

describe("FilterValueEditor — date picker", () => {
  const dateProperty = makeProperty({ type: "date", name: "Due Date" });

  it("renders the date picker for date property", () => {
    render(
      <FilterValueEditor
        {...defaultEditorProps({ property: dateProperty })}
      />,
    );

    expect(screen.getByTestId("mock-date-picker")).toBeInTheDocument();
  });

  it("calls onSelectValue when a date is picked", async () => {
    const user = userEvent.setup();
    const onSelectValue = vi.fn();
    render(
      <FilterValueEditor
        {...defaultEditorProps({ property: dateProperty, onSelectValue })}
      />,
    );

    await user.click(screen.getByText("Pick date"));
    expect(onSelectValue).toHaveBeenCalledWith("2025-06-15");
  });

  it("renders date picker for created_time property", () => {
    render(
      <FilterValueEditor
        {...defaultEditorProps({
          property: makeProperty({ type: "created_time", name: "Created" }),
        })}
      />,
    );

    expect(screen.getByTestId("mock-date-picker")).toBeInTheDocument();
  });

  it("renders date picker for updated_time property", () => {
    render(
      <FilterValueEditor
        {...defaultEditorProps({
          property: makeProperty({ type: "updated_time", name: "Updated" }),
        })}
      />,
    );

    expect(screen.getByTestId("mock-date-picker")).toBeInTheDocument();
  });

  it("calls onClose when date picker close is triggered", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <FilterValueEditor
        {...defaultEditorProps({ property: dateProperty, onClose })}
      />,
    );

    await user.click(screen.getByText("Close date"));
    expect(onClose).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// PropertyPicker
// ---------------------------------------------------------------------------

describe("PropertyPicker", () => {
  const properties: DatabaseProperty[] = [
    makeProperty({ id: "p1", name: "Title", type: "text" }),
    makeProperty({ id: "p2", name: "Amount", type: "number", position: 1 }),
    makeProperty({ id: "p3", name: "Status", type: "select", position: 2 }),
  ];

  it("renders all properties with their names", () => {
    render(<PropertyPicker properties={properties} onSelect={vi.fn()} />);

    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Amount")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("calls onSelect with property id when clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<PropertyPicker properties={properties} onSelect={onSelect} />);

    await user.click(screen.getByText("Amount"));
    expect(onSelect).toHaveBeenCalledWith("p2");
  });
});

// ---------------------------------------------------------------------------
// OperatorPicker
// ---------------------------------------------------------------------------

describe("OperatorPicker", () => {
  it("renders text operators for text type", () => {
    render(<OperatorPicker propertyType="text" onSelect={vi.fn()} />);

    expect(screen.getByTestId("db-filter-operator-contains")).toBeInTheDocument();
    expect(screen.getByTestId("db-filter-operator-equals")).toBeInTheDocument();
    expect(screen.getByTestId("db-filter-operator-is_empty")).toBeInTheDocument();
    expect(screen.getByTestId("db-filter-operator-is_not_empty")).toBeInTheDocument();
  });

  it("renders number operators for number type", () => {
    render(<OperatorPicker propertyType="number" onSelect={vi.fn()} />);

    expect(screen.getByTestId("db-filter-operator-equals")).toBeInTheDocument();
    expect(screen.getByTestId("db-filter-operator-gt")).toBeInTheDocument();
    expect(screen.getByTestId("db-filter-operator-lt")).toBeInTheDocument();
    expect(screen.getByTestId("db-filter-operator-gte")).toBeInTheDocument();
    expect(screen.getByTestId("db-filter-operator-lte")).toBeInTheDocument();
  });

  it("renders checkbox operators for checkbox type", () => {
    render(<OperatorPicker propertyType="checkbox" onSelect={vi.fn()} />);

    expect(screen.getByTestId("db-filter-operator-is_checked")).toBeInTheDocument();
    expect(screen.getByTestId("db-filter-operator-is_not_checked")).toBeInTheDocument();
  });

  it("renders date operators for date type", () => {
    render(<OperatorPicker propertyType="date" onSelect={vi.fn()} />);

    expect(screen.getByTestId("db-filter-operator-equals")).toBeInTheDocument();
    expect(screen.getByTestId("db-filter-operator-before")).toBeInTheDocument();
    expect(screen.getByTestId("db-filter-operator-after")).toBeInTheDocument();
  });

  it("renders select operators for select type", () => {
    render(<OperatorPicker propertyType="select" onSelect={vi.fn()} />);

    expect(screen.getByTestId("db-filter-operator-equals")).toBeInTheDocument();
    expect(screen.getByTestId("db-filter-operator-is_empty")).toBeInTheDocument();
    expect(screen.getByTestId("db-filter-operator-is_not_empty")).toBeInTheDocument();
    // Should not have text-specific operators
    expect(
      screen.queryByTestId("db-filter-operator-contains"),
    ).not.toBeInTheDocument();
  });

  it("calls onSelect with operator when clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<OperatorPicker propertyType="text" onSelect={onSelect} />);

    await user.click(screen.getByTestId("db-filter-operator-contains"));
    expect(onSelect).toHaveBeenCalledWith("contains");
  });

  it("displays human-readable operator labels", () => {
    render(<OperatorPicker propertyType="text" onSelect={vi.fn()} />);

    expect(screen.getByTestId("db-filter-operator-contains")).toHaveTextContent(
      "contains",
    );
    expect(screen.getByTestId("db-filter-operator-equals")).toHaveTextContent(
      "is",
    );
    expect(screen.getByTestId("db-filter-operator-is_empty")).toHaveTextContent(
      "is empty",
    );
  });
});
