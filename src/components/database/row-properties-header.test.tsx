import "@testing-library/jest-dom/vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DatabaseProperty, PropertyType, RowValue } from "@/lib/types";
import {
  RowPropertiesHeader,
  type RowPropertiesHeaderProps,
} from "./row-properties-header";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock editor that renders a data-testid and stores callbacks via data attributes
// so tests can retrieve onChange/onBlur without mutating module-level variables
// inside a React component (which triggers the React compiler lint rule).
const mockEditorRender = vi.fn();

function MockEditor(props: {
  value: Record<string, unknown>;
  property: DatabaseProperty;
  onChange: (v: Record<string, unknown>) => void;
  onBlur: () => void;
}) {
  mockEditorRender(props);
  return (
    <div data-testid="mock-editor">
      {String(props.value?.text ?? props.value?.number ?? "")}
    </div>
  );
}

function MockRenderer({
  value,
}: {
  value: Record<string, unknown>;
  property: DatabaseProperty;
}) {
  return (
    <div data-testid="mock-renderer">
      {String(value?.text ?? value?.number ?? value?.date ?? "")}
    </div>
  );
}

vi.mock("@/components/database/property-types", () => ({
  getPropertyTypeConfig: (type: PropertyType) => {
    if (
      type === "created_time" ||
      type === "updated_time" ||
      type === "created_by"
    ) {
      return { Renderer: MockRenderer, Editor: null };
    }
    if (type === "formula") {
      return { Renderer: MockRenderer, Editor: null };
    }
    return { Renderer: MockRenderer, Editor: MockEditor };
  },
}));

const mockUpdateRowValue = vi.fn<
  (rowId: string, propertyId: string, value: Record<string, unknown>) => Promise<{ data: null; error: null }>
>().mockResolvedValue({ data: null, error: null });

const mockUpdateProperty = vi.fn<
  (propertyId: string, updates: Record<string, unknown>) => Promise<{ data: null; error: null }>
>().mockResolvedValue({ data: null, error: null });

vi.mock("@/lib/database", () => ({
  updateRowValue: (...args: [string, string, Record<string, unknown>]) =>
    mockUpdateRowValue(...args),
  updateProperty: (...args: [string, Record<string, unknown>]) =>
    mockUpdateProperty(...args),
}));

vi.mock("@/lib/sentry", () => ({
  captureSupabaseError: vi.fn(),
  isInsufficientPrivilegeError: () => false,
}));

vi.mock("@/components/database/property-types/formula", () => ({
  evaluateFormulaForRow: () => ({ _display: "42", _error: null }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProp(overrides: Partial<DatabaseProperty> = {}): DatabaseProperty {
  return {
    id: "prop-1",
    database_id: "db-1",
    name: "Name",
    type: "text",
    config: {},
    position: 0,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeValue(
  propertyId: string,
  val: Record<string, unknown> = { text: "hello" },
): RowValue {
  return {
    id: `val-${propertyId}`,
    row_id: "page-1",
    property_id: propertyId,
    value: val,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };
}

const defaultProps: RowPropertiesHeaderProps = {
  pageId: "page-1",
  properties: [
    makeProp({ id: "prop-1", name: "Title", type: "text", position: 0 }),
    makeProp({ id: "prop-2", name: "Count", type: "number", position: 1 }),
    makeProp({ id: "prop-3", name: "Status", type: "select", position: 2 }),
  ],
  values: {
    "prop-1": makeValue("prop-1", { text: "Hello" }),
    "prop-2": makeValue("prop-2", { number: 42 }),
    "prop-3": makeValue("prop-3", { selected: "active" }),
  },
  pageCreatedAt: "2025-06-01T10:00:00Z",
  pageUpdatedAt: "2025-06-15T14:30:00Z",
  pageCreatedBy: "user-abc",
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Renders property names and values
// ---------------------------------------------------------------------------

describe("RowPropertiesHeader — rendering", () => {
  it("renders property names and values for a row", () => {
    render(<RowPropertiesHeader {...defaultProps} />);

    expect(screen.getByTestId("db-row-property-name-prop-1")).toHaveTextContent(
      "Title",
    );
    expect(screen.getByTestId("db-row-property-name-prop-2")).toHaveTextContent(
      "Count",
    );
    expect(screen.getByTestId("db-row-property-name-prop-3")).toHaveTextContent(
      "Status",
    );

    // Values are rendered via MockRenderer
    const renderers = screen.getAllByTestId("mock-renderer");
    expect(renderers.length).toBeGreaterThanOrEqual(3);
  });

  it("returns null when properties array is empty", () => {
    const { container } = render(
      <RowPropertiesHeader {...defaultProps} properties={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Renders correct editor per property type
// ---------------------------------------------------------------------------

describe("RowPropertiesHeader — property type editors", () => {
  it("renders MockRenderer for text property in view mode", () => {
    render(
      <RowPropertiesHeader
        {...defaultProps}
        properties={[
          makeProp({ id: "prop-1", name: "Title", type: "text" }),
        ]}
        values={{
          "prop-1": makeValue("prop-1", { text: "Hello" }),
        }}
      />,
    );

    expect(screen.getByTestId("mock-renderer")).toHaveTextContent("Hello");
  });

  it("renders MockRenderer for number property in view mode", () => {
    render(
      <RowPropertiesHeader
        {...defaultProps}
        properties={[
          makeProp({ id: "prop-2", name: "Count", type: "number" }),
        ]}
        values={{
          "prop-2": makeValue("prop-2", { number: 42 }),
        }}
      />,
    );

    expect(screen.getByTestId("mock-renderer")).toHaveTextContent("42");
  });

  it("renders MockRenderer for select property in view mode", () => {
    render(
      <RowPropertiesHeader
        {...defaultProps}
        properties={[
          makeProp({ id: "prop-3", name: "Status", type: "select" }),
        ]}
        values={{
          "prop-3": makeValue("prop-3", { text: "active" }),
        }}
      />,
    );

    expect(screen.getByTestId("mock-renderer")).toHaveTextContent("active");
  });

  it("renders MockRenderer for date property in view mode", () => {
    render(
      <RowPropertiesHeader
        {...defaultProps}
        properties={[
          makeProp({ id: "prop-d", name: "Due", type: "date" }),
        ]}
        values={{
          "prop-d": makeValue("prop-d", { date: "2025-06-01" }),
        }}
      />,
    );

    expect(screen.getByTestId("mock-renderer")).toHaveTextContent("2025-06-01");
  });
});

// ---------------------------------------------------------------------------
// Handles empty/null values
// ---------------------------------------------------------------------------

describe("RowPropertiesHeader — empty/null values", () => {
  it("renders 'Empty' when a property has no value", () => {
    render(
      <RowPropertiesHeader
        {...defaultProps}
        properties={[
          makeProp({ id: "prop-1", name: "Title", type: "text" }),
        ]}
        values={{}}
      />,
    );

    expect(screen.getByText("Empty")).toBeInTheDocument();
  });

  it("renders 'Empty' when value object is empty", () => {
    render(
      <RowPropertiesHeader
        {...defaultProps}
        properties={[
          makeProp({ id: "prop-1", name: "Title", type: "text" }),
        ]}
        values={{
          "prop-1": makeValue("prop-1", {}),
        }}
      />,
    );

    expect(screen.getByText("Empty")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Calls update callback on value change
// ---------------------------------------------------------------------------

describe("RowPropertiesHeader — update callback", () => {
  it("calls updateRowValue when a property value is changed and blurred", async () => {
    const user = userEvent.setup();

    render(
      <RowPropertiesHeader
        {...defaultProps}
        properties={[
          makeProp({ id: "prop-1", name: "Title", type: "text" }),
        ]}
        values={{
          "prop-1": makeValue("prop-1", { text: "Hello" }),
        }}
      />,
    );

    // Click the renderer button to enter edit mode
    const rendererButton = screen.getByRole("button");
    await user.click(rendererButton);

    // MockEditor should now be rendered
    expect(screen.getByTestId("mock-editor")).toBeInTheDocument();

    // Retrieve onChange from the last MockEditor render call
    const firstCall = mockEditorRender.mock.calls.at(-1)![0];

    // Simulate a value change via the editor's onChange
    act(() => {
      firstCall.onChange({ text: "Updated" });
    });

    // After state update, the component re-renders with a new onBlur that
    // captures the updated currentValue. Retrieve the fresh callback.
    const reRenderedCall = mockEditorRender.mock.calls.at(-1)![0];

    // Simulate blur to persist
    await act(async () => {
      reRenderedCall.onBlur();
    });

    expect(mockUpdateRowValue).toHaveBeenCalledWith(
      "page-1",
      "prop-1",
      { text: "Updated" },
    );
  });
});

// ---------------------------------------------------------------------------
// Computed properties render as read-only
// ---------------------------------------------------------------------------

describe("RowPropertiesHeader — computed properties", () => {
  it("renders created_time as formatted read-only date", () => {
    render(
      <RowPropertiesHeader
        {...defaultProps}
        properties={[
          makeProp({
            id: "prop-ct",
            name: "Created",
            type: "created_time",
          }),
        ]}
        values={{}}
      />,
    );

    // formatDate produces "Jun 1, 2025" for "2025-06-01T10:00:00Z"
    expect(screen.getByText("Jun 1, 2025")).toBeInTheDocument();
  });

  it("renders updated_time as formatted read-only date", () => {
    render(
      <RowPropertiesHeader
        {...defaultProps}
        properties={[
          makeProp({
            id: "prop-ut",
            name: "Updated",
            type: "updated_time",
          }),
        ]}
        values={{}}
      />,
    );

    expect(screen.getByText("Jun 15, 2025")).toBeInTheDocument();
  });

  it("renders created_by as read-only text", () => {
    render(
      <RowPropertiesHeader
        {...defaultProps}
        properties={[
          makeProp({
            id: "prop-cb",
            name: "Created By",
            type: "created_by",
          }),
        ]}
        values={{}}
      />,
    );

    expect(screen.getByText("user-abc")).toBeInTheDocument();
  });

  it("does not show an editor for computed properties on click", async () => {
    const user = userEvent.setup();

    render(
      <RowPropertiesHeader
        {...defaultProps}
        properties={[
          makeProp({
            id: "prop-ct",
            name: "Created",
            type: "created_time",
          }),
        ]}
        values={{}}
      />,
    );

    // The computed value is a span, not a button — no click handler
    const computedValue = screen.getByText("Jun 1, 2025");
    await user.click(computedValue);

    expect(screen.queryByTestId("mock-editor")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Formula properties render as read-only
// ---------------------------------------------------------------------------

describe("RowPropertiesHeader — formula properties", () => {
  it("renders formula result as read-only", () => {
    render(
      <RowPropertiesHeader
        {...defaultProps}
        properties={[
          makeProp({
            id: "prop-f",
            name: "Formula",
            type: "formula",
            config: { expression: "1 + 1" },
          }),
        ]}
        values={{}}
      />,
    );

    // evaluateFormulaForRow mock returns { _display: "42" }
    expect(screen.getByText("42")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Collapse / expand behavior
// ---------------------------------------------------------------------------

describe("RowPropertiesHeader — collapse/expand", () => {
  it("collapses properties beyond the limit and shows expand button", () => {
    const manyProps = Array.from({ length: 8 }, (_, i) =>
      makeProp({ id: `prop-${i}`, name: `Prop ${i}`, type: "text", position: i }),
    );
    const manyValues: Record<string, RowValue> = {};
    manyProps.forEach((p) => {
      manyValues[p.id] = makeValue(p.id, { text: `val-${p.id}` });
    });

    render(
      <RowPropertiesHeader
        {...defaultProps}
        properties={manyProps}
        values={manyValues}
      />,
    );

    // Only first 5 should be visible (COLLAPSED_LIMIT = 5)
    expect(screen.getByText("Prop 0")).toBeInTheDocument();
    expect(screen.getByText("Prop 4")).toBeInTheDocument();
    expect(screen.queryByText("Prop 5")).not.toBeInTheDocument();

    // Should show "Show 3 more" button
    expect(screen.getByText("Show 3 more")).toBeInTheDocument();
  });

  it("expands all properties when expand button is clicked", async () => {
    const user = userEvent.setup();
    const manyProps = Array.from({ length: 8 }, (_, i) =>
      makeProp({ id: `prop-${i}`, name: `Prop ${i}`, type: "text", position: i }),
    );
    const manyValues: Record<string, RowValue> = {};
    manyProps.forEach((p) => {
      manyValues[p.id] = makeValue(p.id, { text: `val-${p.id}` });
    });

    render(
      <RowPropertiesHeader
        {...defaultProps}
        properties={manyProps}
        values={manyValues}
      />,
    );

    await user.click(screen.getByText("Show 3 more"));

    // All 8 properties should now be visible
    expect(screen.getByText("Prop 5")).toBeInTheDocument();
    expect(screen.getByText("Prop 7")).toBeInTheDocument();

    // Button should now say "Show less"
    expect(screen.getByText("Show less")).toBeInTheDocument();
  });

  it("does not show collapse button when properties are within limit", () => {
    render(<RowPropertiesHeader {...defaultProps} />);

    expect(screen.queryByText(/Show \d+ more/)).not.toBeInTheDocument();
    expect(screen.queryByText("Show less")).not.toBeInTheDocument();
  });
});
