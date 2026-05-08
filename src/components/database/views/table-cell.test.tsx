import "@testing-library/jest-dom/vitest";
import { render, screen, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DatabaseProperty, PropertyType, RowValue } from "@/lib/types";
import { TableCell, type TableCellProps } from "./table-cell";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock the property-type registry so we control which Editor/Renderer is used
let editorShouldThrow = false;

function MockEditor() {
  if (editorShouldThrow) {
    throw new Error("Editor render failed");
  }
  return <div data-testid="mock-editor">editor</div>;
}

function MockRenderer({ value }: { value: Record<string, unknown> }) {
  return (
    <div data-testid="mock-renderer">
      {String(value?.text ?? value?.date ?? "")}
    </div>
  );
}

vi.mock("@/components/database/property-types", () => ({
  getPropertyTypeConfig: (type: PropertyType) => {
    // Return null Editor for read-only types
    if (type === "created_time" || type === "updated_time" || type === "created_by") {
      return { Renderer: MockRenderer, Editor: null };
    }
    if (type === "formula") {
      return { Renderer: MockRenderer, Editor: null };
    }
    return { Renderer: MockRenderer, Editor: MockEditor };
  },
}));

// Mock CellRenderer — it's a separate file, mock it to isolate TableCell logic
vi.mock("@/components/database/views/table-cell-renderer", () => ({
  CellRenderer: vi.fn(({ displayValue, propertyType }: {
    displayValue: string;
    propertyType: string;
  }) => (
    <span data-testid="cell-renderer">
      {displayValue || `[${propertyType}]`}
    </span>
  )),
}));

// Mock @floating-ui/react to avoid layout computation in jsdom
vi.mock("@floating-ui/react", () => ({
  computePosition: vi.fn(() =>
    Promise.resolve({ x: 100, y: 200, placement: "bottom-start", middlewareData: {} }),
  ),
  flip: vi.fn(() => ({})),
  shift: vi.fn(() => ({})),
  offset: vi.fn(() => ({})),
}));

// Mock Sentry reporting helpers
const mockCaptureException = vi.fn();
vi.mock("@/lib/sentry", () => ({
  lazyCaptureException: (...args: unknown[]) => mockCaptureException(...args),
  captureSupabaseError: vi.fn(),
}));

// Mock lazy toast wrapper
vi.mock("@/lib/toast", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
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

function makeValue(val: Record<string, unknown> = { text: "hello" }): RowValue {
  return {
    id: "val-1",
    row_id: "row-1",
    property_id: "prop-1",
    value: val,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };
}

function defaultProps(overrides: Partial<TableCellProps> = {}): TableCellProps {
  return {
    rowId: "row-1",
    propertyId: "prop-1",
    property: makeProp(),
    propertyType: "text",
    value: makeValue(),
    isEditing: false,
    isFocused: false,
    rowHeightClass: "h-8",
    rowIndex: 0,
    colIndex: 0,
    onStartEditing: vi.fn(),
    onKeyDown: vi.fn(),
    onBlur: vi.fn(),
    onFocus: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Display mode — renders CellRenderer when not editing
// ---------------------------------------------------------------------------

describe("TableCell — display mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders CellRenderer when not editing", () => {
    render(<TableCell {...defaultProps()} />);
    expect(screen.getByTestId("cell-renderer")).toBeInTheDocument();
  });

  it("click calls onStartEditing for editable types", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<TableCell {...props} />);

    await user.click(screen.getByRole("gridcell"));
    expect(props.onStartEditing).toHaveBeenCalledWith("row-1", "prop-1");
  });

  it("renders with cursor-text for editable types", () => {
    render(<TableCell {...defaultProps()} />);
    const cell = screen.getByRole("gridcell");
    expect(cell.className).toContain("cursor-text");
  });

  it("renders with focus ring when isFocused is true", () => {
    render(<TableCell {...defaultProps({ isFocused: true })} />);
    const cell = screen.getByRole("gridcell");
    expect(cell.className).toContain("ring-1");
  });

  it("sets tabIndex 0 when focused, -1 when not", () => {
    const { rerender } = render(
      <TableCell {...defaultProps({ isFocused: true })} />,
    );
    expect(screen.getByRole("gridcell")).toHaveAttribute("tabindex", "0");

    rerender(<TableCell {...defaultProps({ isFocused: false })} />);
    expect(screen.getByRole("gridcell")).toHaveAttribute("tabindex", "-1");
  });

  it("calls onFocus when cell receives focus", () => {
    const props = defaultProps();
    render(<TableCell {...props} />);
    const cell = screen.getByRole("gridcell");
    cell.focus();
    expect(props.onFocus).toHaveBeenCalledWith(0, 0);
  });
});

// ---------------------------------------------------------------------------
// Read-only cells — created_time, updated_time, created_by, formula
// ---------------------------------------------------------------------------

describe("TableCell — read-only types", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const readOnlyTypes: PropertyType[] = [
    "created_time",
    "updated_time",
    "created_by",
  ];

  for (const type of readOnlyTypes) {
    it(`${type} does not enter edit mode on click`, async () => {
      const user = userEvent.setup();
      const props = defaultProps({
        propertyType: type,
        property: makeProp({ type }),
      });
      render(<TableCell {...props} />);

      await user.click(screen.getByRole("gridcell"));
      expect(props.onStartEditing).not.toHaveBeenCalled();
    });

    it(`${type} renders with cursor-default`, () => {
      render(
        <TableCell
          {...defaultProps({
            propertyType: type,
            property: makeProp({ type }),
          })}
        />,
      );
      const cell = screen.getByRole("gridcell");
      expect(cell.className).toContain("cursor-default");
    });
  }

  it("formula does not enter edit mode on click", async () => {
    const user = userEvent.setup();
    const props = defaultProps({
      propertyType: "formula",
      property: makeProp({ type: "formula" }),
    });
    render(<TableCell {...props} />);

    await user.click(screen.getByRole("gridcell"));
    expect(props.onStartEditing).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Edit mode — plain input (text, number, url, email, phone)
// ---------------------------------------------------------------------------

describe("TableCell — edit mode (plain input)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders an input when isEditing is true for text type", () => {
    render(
      <TableCell
        {...defaultProps({ isEditing: true, propertyType: "text" })}
      />,
    );
    const input = screen.getByRole("textbox");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("type", "text");
  });

  it("renders a number input for number type", () => {
    render(
      <TableCell
        {...defaultProps({
          isEditing: true,
          propertyType: "number",
          property: makeProp({ type: "number" }),
          value: makeValue({ number: 42 }),
        })}
      />,
    );
    const input = screen.getByRole("spinbutton");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("type", "number");
  });

  it("blur commits the edit via onBlur with correct value key", async () => {
    const props = defaultProps({ isEditing: true, propertyType: "text" });
    render(<TableCell {...props} />);

    const input = screen.getByRole("textbox");
    // Clear and type new value
    await userEvent.clear(input);
    await userEvent.type(input, "new value");
    await act(async () => {
      input.blur();
    });

    expect(props.onBlur).toHaveBeenCalledWith("row-1", "prop-1", {
      text: "new value",
    });
  });

  it("blur commits number value as parsed number", async () => {
    const props = defaultProps({
      isEditing: true,
      propertyType: "number",
      property: makeProp({ type: "number" }),
      value: makeValue({ number: 0 }),
    });
    render(<TableCell {...props} />);

    const input = screen.getByRole("spinbutton");
    await userEvent.clear(input);
    await userEvent.type(input, "99");
    await act(async () => {
      input.blur();
    });

    expect(props.onBlur).toHaveBeenCalledWith("row-1", "prop-1", {
      number: 99,
    });
  });

  it("blur commits null for empty number input", async () => {
    const props = defaultProps({
      isEditing: true,
      propertyType: "number",
      property: makeProp({ type: "number" }),
      value: makeValue({ number: 42 }),
    });
    render(<TableCell {...props} />);

    const input = screen.getByRole("spinbutton");
    await userEvent.clear(input);
    await act(async () => {
      input.blur();
    });

    expect(props.onBlur).toHaveBeenCalledWith("row-1", "prop-1", {
      number: null,
    });
  });

  it("passes onKeyDown through to the input", async () => {
    const props = defaultProps({ isEditing: true, propertyType: "text" });
    render(<TableCell {...props} />);

    const input = screen.getByRole("textbox");
    await userEvent.type(input, "{Escape}");

    expect(props.onKeyDown).toHaveBeenCalled();
    const call = props.onKeyDown as ReturnType<typeof vi.fn>;
    const [event, rowIdx, colIdx] = call.mock.calls[0];
    expect(event.key).toBe("Escape");
    expect(rowIdx).toBe(0);
    expect(colIdx).toBe(0);
  });

  it("Enter key is forwarded via onKeyDown", async () => {
    const props = defaultProps({ isEditing: true, propertyType: "text" });
    render(<TableCell {...props} />);

    const input = screen.getByRole("textbox");
    await userEvent.type(input, "{Enter}");

    const call = props.onKeyDown as ReturnType<typeof vi.fn>;
    const enterCalls = call.mock.calls.filter(
      (args: unknown[]) => (args[0] as React.KeyboardEvent).key === "Enter",
    );
    expect(enterCalls.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Edit mode — registry editor (date, select, multi_select, status, checkbox)
// ---------------------------------------------------------------------------

describe("TableCell — edit mode (registry editor)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders registry editor for date type", () => {
    render(
      <TableCell
        {...defaultProps({
          isEditing: true,
          propertyType: "date",
          property: makeProp({ type: "date" }),
          value: makeValue({ date: "2025-06-15" }),
        })}
      />,
    );
    // The mock editor should be rendered (possibly in a portal)
    expect(screen.getByTestId("mock-editor")).toBeInTheDocument();
  });

  it("renders registry editor for select type", () => {
    render(
      <TableCell
        {...defaultProps({
          isEditing: true,
          propertyType: "select",
          property: makeProp({ type: "select" }),
          value: makeValue({ option_id: "opt-1" }),
        })}
      />,
    );
    expect(screen.getByTestId("mock-editor")).toBeInTheDocument();
  });

  it("renders registry editor for multi_select type", () => {
    render(
      <TableCell
        {...defaultProps({
          isEditing: true,
          propertyType: "multi_select",
          property: makeProp({ type: "multi_select" }),
          value: makeValue({ option_ids: ["opt-1"] }),
        })}
      />,
    );
    expect(screen.getByTestId("mock-editor")).toBeInTheDocument();
  });

  it("renders registry editor for status type", () => {
    render(
      <TableCell
        {...defaultProps({
          isEditing: true,
          propertyType: "status",
          property: makeProp({ type: "status" }),
          value: makeValue({ option_id: "opt-1" }),
        })}
      />,
    );
    expect(screen.getByTestId("mock-editor")).toBeInTheDocument();
  });

  it("does not render plain input for date type in edit mode", () => {
    render(
      <TableCell
        {...defaultProps({
          isEditing: true,
          propertyType: "date",
          property: makeProp({ type: "date" }),
        })}
      />,
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Portal vs inline rendering for registry editors
// ---------------------------------------------------------------------------

describe("TableCell — portal vs inline rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const portaledTypes: PropertyType[] = ["date", "select", "multi_select", "status"];

  for (const type of portaledTypes) {
    it(`${type} editor is rendered via portal (in document.body)`, () => {
      const { container } = render(
        <TableCell
          {...defaultProps({
            isEditing: true,
            propertyType: type,
            property: makeProp({ type }),
            value: makeValue({}),
          })}
        />,
      );

      // The editor should NOT be inside the component's container tree
      // but should be in document.body (via portal)
      const editorInContainer = container.querySelector(
        '[data-testid="mock-editor"]',
      );
      expect(editorInContainer).toBeNull();

      // But it should exist in the document (rendered via portal to body)
      const editorInBody = document.body.querySelector(
        '[data-testid="mock-editor"]',
      );
      expect(editorInBody).not.toBeNull();
    });
  }

  it("checkbox editor renders inline (not portaled)", () => {
    const { container } = render(
      <TableCell
        {...defaultProps({
          isEditing: true,
          propertyType: "checkbox",
          property: makeProp({ type: "checkbox" }),
          value: makeValue({ checked: false }),
        })}
      />,
    );

    // Checkbox uses the registry editor but is NOT in PORTALED_EDITOR_TYPES,
    // so it renders inline within the container
    const editorInContainer = container.querySelector(
      '[data-testid="mock-editor"]',
    );
    expect(editorInContainer).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CellEditorErrorBoundary — catches render errors, shows fallback, reports
// ---------------------------------------------------------------------------

describe("TableCell — CellEditorErrorBoundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    editorShouldThrow = false;
  });

  it("shows fallback UI when editor throws during render", () => {
    editorShouldThrow = true;

    // Suppress React error boundary console.error noise
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <TableCell
        {...defaultProps({
          isEditing: true,
          propertyType: "date",
          property: makeProp({ type: "date" }),
          value: makeValue({ date: "2025-06-15" }),
        })}
      />,
    );

    // The error boundary should render "Error" fallback text
    expect(screen.getByText("Error")).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it("reports error to Sentry via lazyCaptureException", () => {
    editorShouldThrow = true;

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <TableCell
        {...defaultProps({
          isEditing: true,
          propertyType: "date",
          property: makeProp({ type: "date" }),
          value: makeValue({ date: "2025-06-15" }),
        })}
      />,
    );

    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        extra: expect.objectContaining({
          operation: "table-view:cell-editor-render",
        }),
        level: "warning",
      }),
    );

    consoleSpy.mockRestore();
  });

  it("error boundary fallback has gridcell role", () => {
    editorShouldThrow = true;

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <TableCell
        {...defaultProps({
          isEditing: true,
          propertyType: "date",
          property: makeProp({ type: "date" }),
          value: makeValue({ date: "2025-06-15" }),
        })}
      />,
    );

    const fallbackCell = screen.getByText("Error").closest('[role="gridcell"]');
    expect(fallbackCell).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it("inline (non-portaled) editor errors are also caught", () => {
    editorShouldThrow = true;

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <TableCell
        {...defaultProps({
          isEditing: true,
          propertyType: "checkbox",
          property: makeProp({ type: "checkbox" }),
          value: makeValue({ checked: false }),
        })}
      />,
    );

    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        extra: expect.objectContaining({
          operation: "table-view:cell-editor-render",
        }),
      }),
    );

    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Checkbox type — special toggle behavior
// ---------------------------------------------------------------------------

describe("TableCell — checkbox type", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a check button when not editing", () => {
    render(
      <TableCell
        {...defaultProps({
          propertyType: "checkbox",
          property: makeProp({ type: "checkbox" }),
          value: makeValue({ checked: true }),
        })}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Uncheck" }),
    ).toBeInTheDocument();
  });

  it("toggles checkbox on click (checked → unchecked)", async () => {
    const user = userEvent.setup();
    const props = defaultProps({
      propertyType: "checkbox",
      property: makeProp({ type: "checkbox" }),
      value: makeValue({ checked: true }),
    });
    render(<TableCell {...props} />);

    await user.click(screen.getByRole("button", { name: "Uncheck" }));
    expect(props.onBlur).toHaveBeenCalledWith("row-1", "prop-1", {
      checked: false,
    });
  });

  it("toggles checkbox on click (unchecked → checked)", async () => {
    const user = userEvent.setup();
    const props = defaultProps({
      propertyType: "checkbox",
      property: makeProp({ type: "checkbox" }),
      value: makeValue({ checked: false }),
    });
    render(<TableCell {...props} />);

    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(props.onBlur).toHaveBeenCalledWith("row-1", "prop-1", {
      checked: true,
    });
  });
});

// ---------------------------------------------------------------------------
// Computed value rendering
// ---------------------------------------------------------------------------

describe("TableCell — computed value rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders registry Renderer for computed types with computedValue", () => {
    render(
      <TableCell
        {...defaultProps({
          propertyType: "created_time",
          property: makeProp({ type: "created_time" }),
          computedValue: { created_time: "2025-01-01T00:00:00Z" },
        })}
      />,
    );
    expect(screen.getByTestId("mock-renderer")).toBeInTheDocument();
  });

  it("computed value cell has cursor-default", () => {
    render(
      <TableCell
        {...defaultProps({
          propertyType: "created_time",
          property: makeProp({ type: "created_time" }),
          computedValue: { created_time: "2025-01-01T00:00:00Z" },
        })}
      />,
    );
    const cell = screen.getByRole("gridcell");
    expect(cell.className).toContain("cursor-default");
  });
});

// ---------------------------------------------------------------------------
// Keyboard interaction — Enter triggers edit mode
// ---------------------------------------------------------------------------

describe("TableCell — keyboard interaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("onKeyDown is forwarded with row and column indices in edit mode", async () => {
    const props = defaultProps({
      isEditing: true,
      propertyType: "text",
      rowIndex: 2,
      colIndex: 3,
    });
    render(<TableCell {...props} />);

    const input = screen.getByRole("textbox");
    await userEvent.type(input, "{Enter}");

    const call = props.onKeyDown as ReturnType<typeof vi.fn>;
    expect(call).toHaveBeenCalled();
    const enterCall = call.mock.calls.find(
      (args: unknown[]) => (args[0] as React.KeyboardEvent).key === "Enter",
    );
    expect(enterCall).toBeDefined();
    expect(enterCall![1]).toBe(2);
    expect(enterCall![2]).toBe(3);
  });
});
