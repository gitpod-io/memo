import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import type { DatabaseProperty } from "@/lib/types";
import { DateRenderer, DateEditor, formatDate } from "./date";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProp(): DatabaseProperty {
  return {
    id: "prop-1",
    database_id: "db-1",
    name: "Due Date",
    type: "date",
    config: {},
    position: 0,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };
}

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe("formatDate", () => {
  it("defaults to short format", () => {
    expect(formatDate("2025-06-15")).toBe("Jun 15, 2025");
  });

  it("formats as full", () => {
    expect(formatDate("2025-06-15", "full")).toBe("June 15, 2025");
  });

  it("formats as iso", () => {
    expect(formatDate("2025-06-15", "iso")).toBe("2025-06-15");
  });

  it("formats as slash", () => {
    expect(formatDate("2025-06-15", "slash")).toBe("6/15/2025");
  });

  it("formats as short explicitly", () => {
    expect(formatDate("2025-01-01", "short")).toBe("Jan 1, 2025");
  });

  it("returns empty string for invalid date", () => {
    expect(formatDate("not-a-date", "full")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// DateRenderer
// ---------------------------------------------------------------------------

describe("DateRenderer", () => {
  it("renders a formatted date", () => {
    render(
      <DateRenderer
        value={{ date: "2025-06-15" }}
        property={makeProp()}
      />,
    );
    expect(screen.getByText("Jun 15, 2025")).toBeInTheDocument();
  });

  it("renders a date range with arrow", () => {
    render(
      <DateRenderer
        value={{ date: "2025-06-15", end_date: "2025-06-20" }}
        property={makeProp()}
      />,
    );
    expect(screen.getByText(/Jun 15, 2025 → Jun 20, 2025/)).toBeInTheDocument();
  });

  it("renders nothing when date is absent", () => {
    const { container } = render(
      <DateRenderer value={{}} property={makeProp()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for invalid date string", () => {
    const { container } = render(
      <DateRenderer value={{ date: "not-a-date" }} property={makeProp()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders start date only when end_date is invalid", () => {
    render(
      <DateRenderer
        value={{ date: "2025-03-01", end_date: "invalid" }}
        property={makeProp()}
      />,
    );
    expect(screen.getByText("Mar 1, 2025")).toBeInTheDocument();
    expect(screen.queryByText(/→/)).toBeNull();
  });

  it("renders in full format when config.date_format is full", () => {
    const prop = makeProp();
    prop.config = { date_format: "full" };
    render(
      <DateRenderer value={{ date: "2025-06-15" }} property={prop} />,
    );
    expect(screen.getByText("June 15, 2025")).toBeInTheDocument();
  });

  it("renders in ISO format when config.date_format is iso", () => {
    const prop = makeProp();
    prop.config = { date_format: "iso" };
    render(
      <DateRenderer value={{ date: "2025-06-15" }} property={prop} />,
    );
    expect(screen.getByText("2025-06-15")).toBeInTheDocument();
  });

  it("renders in slash format when config.date_format is slash", () => {
    const prop = makeProp();
    prop.config = { date_format: "slash" };
    render(
      <DateRenderer value={{ date: "2025-06-15" }} property={prop} />,
    );
    expect(screen.getByText("6/15/2025")).toBeInTheDocument();
  });

  it("renders date range in the configured format", () => {
    const prop = makeProp();
    prop.config = { date_format: "iso" };
    render(
      <DateRenderer
        value={{ date: "2025-06-15", end_date: "2025-06-20" }}
        property={prop}
      />,
    );
    expect(screen.getByText(/2025-06-15 → 2025-06-20/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// DateEditor
// ---------------------------------------------------------------------------

describe("DateEditor", () => {
  it("renders a date picker with month/year header", () => {
    render(
      <DateEditor
        value={{ date: "2025-06-15" }}
        property={makeProp()}
        onChange={vi.fn()}
        onBlur={vi.fn()}
      />,
    );
    expect(screen.getByText("June 2025")).toBeInTheDocument();
  });

  it("renders day-of-week headers", () => {
    render(
      <DateEditor
        value={{ date: "2025-06-15" }}
        property={makeProp()}
        onChange={vi.fn()}
        onBlur={vi.fn()}
      />,
    );
    expect(screen.getByText("Su")).toBeInTheDocument();
    expect(screen.getByText("Mo")).toBeInTheDocument();
    expect(screen.getByText("Sa")).toBeInTheDocument();
  });

  it("calls onChange when a day is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <DateEditor
        value={{ date: "2025-06-15" }}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    // Click day 20
    await user.click(screen.getByText("20"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ date: "2025-06-20" }),
    );
  });

  it("navigates to previous month", async () => {
    const user = userEvent.setup();
    render(
      <DateEditor
        value={{ date: "2025-06-15" }}
        property={makeProp()}
        onChange={vi.fn()}
        onBlur={vi.fn()}
      />,
    );
    await user.click(screen.getByLabelText("Previous month"));
    expect(screen.getByText("May 2025")).toBeInTheDocument();
  });

  it("navigates to next month", async () => {
    const user = userEvent.setup();
    render(
      <DateEditor
        value={{ date: "2025-06-15" }}
        property={makeProp()}
        onChange={vi.fn()}
        onBlur={vi.fn()}
      />,
    );
    await user.click(screen.getByLabelText("Next month"));
    expect(screen.getByText("July 2025")).toBeInTheDocument();
  });

  it("has a Today button", () => {
    render(
      <DateEditor
        value={{ date: "2025-06-15" }}
        property={makeProp()}
        onChange={vi.fn()}
        onBlur={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Today" }),
    ).toBeInTheDocument();
  });

  it("opens to current month when no date is set", () => {
    const now = new Date();
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    const expected = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

    render(
      <DateEditor
        value={{}}
        property={makeProp()}
        onChange={vi.fn()}
        onBlur={vi.fn()}
      />,
    );
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});
