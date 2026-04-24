import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import type { DatabaseProperty, SelectOption } from "@/lib/types";
import { SelectRenderer, SelectEditor } from "./select";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OPTIONS: SelectOption[] = [
  { id: "opt-1", name: "High", color: "red" },
  { id: "opt-2", name: "Medium", color: "yellow" },
  { id: "opt-3", name: "Low", color: "green" },
];

function makeProp(
  options: SelectOption[] = OPTIONS,
): DatabaseProperty {
  return {
    id: "prop-1",
    database_id: "db-1",
    name: "Priority",
    type: "select",
    config: { options },
    position: 0,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };
}

// ---------------------------------------------------------------------------
// SelectRenderer
// ---------------------------------------------------------------------------

describe("SelectRenderer", () => {
  it("renders the selected option badge", () => {
    render(
      <SelectRenderer
        value={{ option_id: "opt-1" }}
        property={makeProp()}
      />,
    );
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("renders nothing when no option is selected", () => {
    const { container } = render(
      <SelectRenderer value={{}} property={makeProp()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when option_id is null", () => {
    const { container } = render(
      <SelectRenderer value={{ option_id: null }} property={makeProp()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when option_id does not match any option", () => {
    const { container } = render(
      <SelectRenderer
        value={{ option_id: "nonexistent" }}
        property={makeProp()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when config has no options", () => {
    const { container } = render(
      <SelectRenderer
        value={{ option_id: "opt-1" }}
        property={makeProp([])}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// SelectEditor
// ---------------------------------------------------------------------------

describe("SelectEditor", () => {
  it("renders the dropdown with all options", () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <SelectEditor
        value={{}}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("Low")).toBeInTheDocument();
  });

  it("calls onChange with option_id when an option is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <SelectEditor
        value={{}}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    await user.click(screen.getByText("Medium"));
    expect(onChange).toHaveBeenCalledWith({ option_id: "opt-2" });
  });

  it("filters options by search query", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <SelectEditor
        value={{}}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    const input = screen.getByPlaceholderText("Search or create…");
    await user.type(input, "hi");
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.queryByText("Medium")).toBeNull();
    expect(screen.queryByText("Low")).toBeNull();
  });

  it("shows create button for new option names", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <SelectEditor
        value={{}}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    const input = screen.getByPlaceholderText("Search or create…");
    await user.type(input, "Critical");
    expect(screen.getByText("Create")).toBeInTheDocument();
  });

  it("creates a new option when the create button is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <SelectEditor
        value={{}}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    const input = screen.getByPlaceholderText("Search or create…");
    await user.type(input, "Critical");
    await user.click(screen.getByText("Create"));
    // onChange should be called with the new option_id and _newOptions
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        option_id: expect.any(String),
        _newOptions: expect.arrayContaining([
          expect.objectContaining({ name: "Critical" }),
        ]),
      }),
    );
  });

  it("calls onBlur (onClose) when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <SelectEditor
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
