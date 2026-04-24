import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import type { DatabaseProperty } from "@/lib/types";
import { FormulaRenderer } from "./formula";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProp(
  config: Record<string, unknown> = {},
): DatabaseProperty {
  return {
    id: "prop-1",
    database_id: "db-1",
    name: "Total",
    type: "formula",
    config,
    position: 0,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };
}

// ---------------------------------------------------------------------------
// FormulaRenderer
// ---------------------------------------------------------------------------

describe("FormulaRenderer", () => {
  it("renders the computed display value", () => {
    render(
      <FormulaRenderer
        value={{ _display: "42", _error: null }}
        property={makeProp()}
      />,
    );
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders 'Error' when _error is set", () => {
    render(
      <FormulaRenderer
        value={{ _display: null, _error: "Division by zero" }}
        property={makeProp()}
      />,
    );
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("renders nothing when _display is empty and no error", () => {
    const { container } = render(
      <FormulaRenderer
        value={{ _display: "", _error: null }}
        property={makeProp()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when value has no _display or _error", () => {
    const { container } = render(
      <FormulaRenderer value={{}} property={makeProp()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("prioritizes error over display", () => {
    render(
      <FormulaRenderer
        value={{ _display: "42", _error: "some error" }}
        property={makeProp()}
      />,
    );
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.queryByText("42")).toBeNull();
  });

  it("renders string display values", () => {
    render(
      <FormulaRenderer
        value={{ _display: "Hello World", _error: null }}
        property={makeProp()}
      />,
    );
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });
});
