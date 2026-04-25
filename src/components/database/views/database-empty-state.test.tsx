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
      screen.getByText(/click .+\+ new.+ below to add a row/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId("db-empty-state-no-rows")).toBeInTheDocument();
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
});
