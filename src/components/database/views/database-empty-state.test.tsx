import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { DatabaseEmptyState } from "./database-empty-state";

describe("DatabaseEmptyState", () => {
  // --- No filters active (genuine empty) ---

  it("renders 'No rows yet' when hasActiveFilters is false", () => {
    render(<DatabaseEmptyState hasActiveFilters={false} />);

    expect(screen.getByText("No rows yet")).toBeInTheDocument();
    expect(
      screen.getByText("Add your first row to get started."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("db-empty-state-no-rows")).toBeInTheDocument();
  });

  it("renders heading with correct design spec classes", () => {
    const { container } = render(<DatabaseEmptyState hasActiveFilters={false} />);

    const heading = container.querySelector("p.text-lg.font-medium");
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent("No rows yet");
  });

  it("renders description with correct design spec classes", () => {
    const { container } = render(<DatabaseEmptyState hasActiveFilters={false} />);

    const description = container.querySelector("p.text-sm.text-muted-foreground");
    expect(description).toBeInTheDocument();
    expect(description).toHaveTextContent("Add your first row to get started.");
  });

  it("does not show 'Clear filters' button when hasActiveFilters is false", () => {
    render(<DatabaseEmptyState hasActiveFilters={false} />);

    expect(screen.queryByTestId("db-clear-filters-button")).not.toBeInTheDocument();
  });

  it("does not show filter message when hasActiveFilters is false", () => {
    render(<DatabaseEmptyState hasActiveFilters={false} />);

    expect(
      screen.queryByText("No rows match the active filters"),
    ).not.toBeInTheDocument();
  });

  // --- CTA button (Add a row) ---

  it("renders 'Add a row' button when onAddRow is provided", () => {
    render(<DatabaseEmptyState hasActiveFilters={false} onAddRow={vi.fn()} />);

    expect(screen.getByTestId("db-empty-state-add-row")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add a row/i })).toBeInTheDocument();
  });

  it("calls onAddRow when 'Add a row' button is clicked", async () => {
    const user = userEvent.setup();
    const onAddRow = vi.fn();

    render(<DatabaseEmptyState hasActiveFilters={false} onAddRow={onAddRow} />);

    await user.click(screen.getByTestId("db-empty-state-add-row"));
    expect(onAddRow).toHaveBeenCalledTimes(1);
  });

  it("does not render 'Add a row' button when onAddRow is undefined", () => {
    render(<DatabaseEmptyState hasActiveFilters={false} />);

    expect(screen.queryByTestId("db-empty-state-add-row")).not.toBeInTheDocument();
  });

  // --- Filters active (filtered empty) ---

  it("renders filter message when hasActiveFilters is true", () => {
    render(
      <DatabaseEmptyState hasActiveFilters={true} onClearFilters={vi.fn()} />,
    );

    expect(
      screen.getByText("No rows match the active filters"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("db-empty-state-filtered")).toBeInTheDocument();
  });

  it("does not show 'No rows yet' when hasActiveFilters is true", () => {
    render(
      <DatabaseEmptyState hasActiveFilters={true} onClearFilters={vi.fn()} />,
    );

    expect(screen.queryByText("No rows yet")).not.toBeInTheDocument();
  });

  it("renders 'Clear filters' button when onClearFilters is provided", () => {
    render(
      <DatabaseEmptyState hasActiveFilters={true} onClearFilters={vi.fn()} />,
    );

    expect(screen.getByTestId("db-clear-filters-button")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /clear filters/i })).toBeInTheDocument();
  });

  it("calls onClearFilters when 'Clear filters' button is clicked", async () => {
    const user = userEvent.setup();
    const onClearFilters = vi.fn();

    render(
      <DatabaseEmptyState hasActiveFilters={true} onClearFilters={onClearFilters} />,
    );

    await user.click(screen.getByTestId("db-clear-filters-button"));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it("does not render 'Clear filters' button when onClearFilters is undefined", () => {
    render(<DatabaseEmptyState hasActiveFilters={true} />);

    expect(screen.queryByTestId("db-clear-filters-button")).not.toBeInTheDocument();
    // Still shows the filter message
    expect(
      screen.getByText("No rows match the active filters"),
    ).toBeInTheDocument();
  });

  it("renders filtered heading with correct design spec classes", () => {
    const { container } = render(
      <DatabaseEmptyState hasActiveFilters={true} onClearFilters={vi.fn()} />,
    );

    const heading = container.querySelector("p.text-lg.font-medium");
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent("No rows match the active filters");
  });
});
