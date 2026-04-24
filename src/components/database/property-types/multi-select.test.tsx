import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import type { DatabaseProperty, SelectOption } from "@/lib/types";
import { MultiSelectRenderer, MultiSelectEditor } from "./multi-select";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OPTIONS: SelectOption[] = [
  { id: "tag-1", name: "Frontend", color: "blue" },
  { id: "tag-2", name: "Backend", color: "green" },
  { id: "tag-3", name: "Design", color: "purple" },
];

function makeProp(
  options: SelectOption[] = OPTIONS,
): DatabaseProperty {
  return {
    id: "prop-1",
    database_id: "db-1",
    name: "Tags",
    type: "multi_select",
    config: { options },
    position: 0,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };
}

// ---------------------------------------------------------------------------
// MultiSelectRenderer
// ---------------------------------------------------------------------------

describe("MultiSelectRenderer", () => {
  it("renders multiple option badges", () => {
    render(
      <MultiSelectRenderer
        value={{ option_ids: ["tag-1", "tag-2"] }}
        property={makeProp()}
      />,
    );
    expect(screen.getByText("Frontend")).toBeInTheDocument();
    expect(screen.getByText("Backend")).toBeInTheDocument();
  });

  it("renders nothing when option_ids is empty", () => {
    const { container } = render(
      <MultiSelectRenderer
        value={{ option_ids: [] }}
        property={makeProp()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when option_ids is absent", () => {
    const { container } = render(
      <MultiSelectRenderer value={{}} property={makeProp()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("skips option_ids that do not match any option", () => {
    render(
      <MultiSelectRenderer
        value={{ option_ids: ["tag-1", "nonexistent"] }}
        property={makeProp()}
      />,
    );
    expect(screen.getByText("Frontend")).toBeInTheDocument();
    // "nonexistent" should not render anything
    expect(screen.queryByText("nonexistent")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// MultiSelectEditor
// ---------------------------------------------------------------------------

describe("MultiSelectEditor", () => {
  it("renders the dropdown with all options", () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <MultiSelectEditor
        value={{ option_ids: [] }}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    expect(screen.getByText("Frontend")).toBeInTheDocument();
    expect(screen.getByText("Backend")).toBeInTheDocument();
    expect(screen.getByText("Design")).toBeInTheDocument();
  });

  it("calls onChange with added option_id when an option is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <MultiSelectEditor
        value={{ option_ids: ["tag-1"] }}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    await user.click(screen.getByText("Backend"));
    expect(onChange).toHaveBeenCalledWith({
      option_ids: ["tag-1", "tag-2"],
    });
  });

  it("calls onChange with removed option_id when a selected option is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <MultiSelectEditor
        value={{ option_ids: ["tag-1", "tag-2"] }}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    await user.click(screen.getByText("Frontend"));
    expect(onChange).toHaveBeenCalledWith({
      option_ids: ["tag-2"],
    });
  });

  it("filters options by search query", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <MultiSelectEditor
        value={{ option_ids: [] }}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    const input = screen.getByPlaceholderText("Search or create…");
    await user.type(input, "front");
    expect(screen.getByText("Frontend")).toBeInTheDocument();
    expect(screen.queryByText("Backend")).toBeNull();
  });

  it("creates a new option and adds it to selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <MultiSelectEditor
        value={{ option_ids: ["tag-1"] }}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    const input = screen.getByPlaceholderText("Search or create…");
    await user.type(input, "DevOps");
    await user.click(screen.getByText("Create"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        option_ids: expect.arrayContaining(["tag-1"]),
        _newOptions: expect.arrayContaining([
          expect.objectContaining({ name: "DevOps" }),
        ]),
      }),
    );
    // The new option_ids should have 2 entries (tag-1 + new)
    const call = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(call.option_ids).toHaveLength(2);
  });

  it("calls onBlur (onClose) when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <MultiSelectEditor
        value={{ option_ids: [] }}
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
