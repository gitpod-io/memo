import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import type { DatabaseProperty } from "@/lib/types";
import { CheckboxRenderer, CheckboxEditor } from "./checkbox";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProp(): DatabaseProperty {
  return {
    id: "prop-1",
    database_id: "db-1",
    name: "Done",
    type: "checkbox",
    config: {},
    position: 0,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };
}

// ---------------------------------------------------------------------------
// CheckboxRenderer
// ---------------------------------------------------------------------------

describe("CheckboxRenderer", () => {
  it("renders checked state from value.checked = true", () => {
    const { container } = render(
      <CheckboxRenderer value={{ checked: true }} property={makeProp()} />,
    );
    // The check icon SVG is rendered when checked
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders unchecked state from value.checked = false", () => {
    const { container } = render(
      <CheckboxRenderer value={{ checked: false }} property={makeProp()} />,
    );
    expect(container.querySelector("svg")).toBeNull();
  });

  it("reads from value.value as fallback", () => {
    const { container } = render(
      <CheckboxRenderer value={{ value: true }} property={makeProp()} />,
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("treats missing value as unchecked", () => {
    const { container } = render(
      <CheckboxRenderer value={{}} property={makeProp()} />,
    );
    expect(container.querySelector("svg")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CheckboxEditor
// ---------------------------------------------------------------------------

describe("CheckboxEditor", () => {
  it("renders a checkbox role element", () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <CheckboxEditor
        value={{ checked: false }}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("toggles from unchecked to checked on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <CheckboxEditor
        value={{ checked: false }}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    await user.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledWith({ checked: true });
    expect(onBlur).toHaveBeenCalled();
  });

  it("toggles from checked to unchecked on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <CheckboxEditor
        value={{ checked: true }}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    await user.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledWith({ checked: false });
    expect(onBlur).toHaveBeenCalled();
  });

  it("reflects aria-checked attribute", () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <CheckboxEditor
        value={{ checked: true }}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    expect(screen.getByRole("checkbox")).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});
