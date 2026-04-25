import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { DatabaseProperty, SelectOption } from "@/lib/types";
import { StatusRenderer, StatusEditor, DEFAULT_STATUS_OPTIONS } from "./status";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OPTIONS: SelectOption[] = [
  { id: "s-1", name: "Todo", color: "gray" },
  { id: "s-2", name: "In Progress", color: "blue" },
  { id: "s-3", name: "Done", color: "green" },
];

function makeProp(options: SelectOption[] = OPTIONS): DatabaseProperty {
  return {
    id: "prop-1",
    database_id: "db-1",
    name: "Status",
    type: "status",
    config: { options },
    position: 0,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };
}

// ---------------------------------------------------------------------------
// Mock crypto.randomUUID for deterministic IDs
// ---------------------------------------------------------------------------

let uuidCounter = 0;
const originalRandomUUID = crypto.randomUUID.bind(crypto);

beforeEach(() => {
  uuidCounter = 0;
  vi.spyOn(crypto, "randomUUID").mockImplementation(
    () => `test-uuid-${++uuidCounter}` as ReturnType<typeof crypto.randomUUID>,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  // Restore in case spyOn didn't cover it
  if (crypto.randomUUID !== originalRandomUUID) {
    crypto.randomUUID = originalRandomUUID;
  }
});

// ---------------------------------------------------------------------------
// StatusRenderer
// ---------------------------------------------------------------------------

describe("StatusRenderer", () => {
  it("renders the correct SelectOptionBadge for a given option_id", () => {
    render(
      <StatusRenderer value={{ option_id: "s-2" }} property={makeProp()} />,
    );
    expect(screen.getByText("In Progress")).toBeInTheDocument();
  });

  it("returns null when option_id is missing", () => {
    const { container } = render(
      <StatusRenderer value={{}} property={makeProp()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null when option_id is null", () => {
    const { container } = render(
      <StatusRenderer value={{ option_id: null }} property={makeProp()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null when option_id does not match any option", () => {
    const { container } = render(
      <StatusRenderer
        value={{ option_id: "nonexistent" }}
        property={makeProp()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("uses DEFAULT_STATUS_OPTIONS when property.config.options is empty", () => {
    render(
      <StatusRenderer
        value={{ option_id: "status-in-progress" }}
        property={makeProp([])}
      />,
    );
    expect(screen.getByText("In Progress")).toBeInTheDocument();
  });

  it("uses DEFAULT_STATUS_OPTIONS when property.config.options is undefined", () => {
    const prop = makeProp();
    prop.config = {};
    render(
      <StatusRenderer value={{ option_id: "status-done" }} property={prop} />,
    );
    expect(screen.getByText("Done")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// StatusEditor
// ---------------------------------------------------------------------------

describe("StatusEditor", () => {
  it("renders SelectDropdown with options from config", () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <StatusEditor
        value={{}}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    expect(screen.getByText("Todo")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("renders SelectDropdown with DEFAULT_STATUS_OPTIONS when config is empty", () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <StatusEditor
        value={{}}
        property={makeProp([])}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    for (const opt of DEFAULT_STATUS_OPTIONS) {
      expect(screen.getByText(opt.name)).toBeInTheDocument();
    }
  });

  it("calls onChange with { option_id } on select", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <StatusEditor
        value={{}}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    await user.click(screen.getByText("Done"));
    expect(onChange).toHaveBeenCalledWith({ option_id: "s-3" });
  });

  it("calls onChange with { option_id: null } on deselect", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <StatusEditor
        value={{ option_id: "s-1" }}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    // Clicking the already-selected option deselects it
    await user.click(screen.getByText("Todo"));
    expect(onChange).toHaveBeenCalledWith({ option_id: null });
  });

  it("creates a new option with crypto.randomUUID and correct color", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <StatusEditor
        value={{}}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    const input = screen.getByPlaceholderText("Search or create…");
    await user.type(input, "Blocked");
    await user.click(screen.getByText("Create"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        option_id: "test-uuid-1",
        _newOptions: expect.arrayContaining([
          expect.objectContaining({ id: "test-uuid-1", name: "Blocked" }),
        ]),
      }),
    );
  });

  it("handles color change and passes _newOptions in onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <StatusEditor
        value={{ option_id: "s-1" }}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    // Open the color picker for the first option by clicking its color dot
    const colorDots = screen.getAllByLabelText("Change color");
    expect(colorDots.length).toBeGreaterThan(0);
    await user.click(colorDots[0]);
    // Pick "red" from the color palette
    const redColor = screen.getByLabelText("Color: red");
    await user.click(redColor);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        option_id: "s-1",
        _newOptions: expect.arrayContaining([
          expect.objectContaining({ id: "s-1", color: "red" }),
        ]),
      }),
    );
  });

  it("filters options by search query", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <StatusEditor
        value={{}}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    const input = screen.getByPlaceholderText("Search or create…");
    await user.type(input, "Done");
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.queryByText("Todo")).toBeNull();
    expect(screen.queryByText("In Progress")).toBeNull();
  });

  it("calls onBlur (onClose) when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <StatusEditor
        value={{}}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    const input = screen.getByPlaceholderText("Search or create…");
    await user.type(input, "{Escape}");
    expect(onBlur).toHaveBeenCalled();
  });
});
