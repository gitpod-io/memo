import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RowCountStatusBar } from "./row-count-status-bar";

describe("RowCountStatusBar", () => {
  it("shows total count when no filters are active", () => {
    render(<RowCountStatusBar filteredCount={42} totalCount={42} />);
    expect(screen.getByText("42 rows")).toBeDefined();
  });

  it("shows filtered vs total count when filters are active", () => {
    render(<RowCountStatusBar filteredCount={12} totalCount={42} />);
    expect(screen.getByText("12 of 42 rows")).toBeDefined();
  });

  it("shows 0 rows for empty database", () => {
    render(<RowCountStatusBar filteredCount={0} totalCount={0} />);
    expect(screen.getByText("0 rows")).toBeDefined();
  });

  it("shows 0 of N rows when all rows are filtered out", () => {
    render(<RowCountStatusBar filteredCount={0} totalCount={25} />);
    expect(screen.getByText("0 of 25 rows")).toBeDefined();
  });

  it("shows singular-style count for 1 row", () => {
    render(<RowCountStatusBar filteredCount={1} totalCount={1} />);
    expect(screen.getByText("1 rows")).toBeDefined();
  });
});
