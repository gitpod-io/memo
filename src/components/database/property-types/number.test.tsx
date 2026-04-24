import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import type { DatabaseProperty } from "@/lib/types";
import { NumberRenderer, NumberEditor } from "./number";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProp(
  config: Record<string, unknown> = {},
): DatabaseProperty {
  return {
    id: "prop-1",
    database_id: "db-1",
    name: "Amount",
    type: "number",
    config,
    position: 0,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };
}

// ---------------------------------------------------------------------------
// NumberRenderer
// ---------------------------------------------------------------------------

describe("NumberRenderer", () => {
  it("renders a plain number with locale formatting", () => {
    render(
      <NumberRenderer value={{ number: 1234 }} property={makeProp()} />,
    );
    expect(screen.getByText("1,234")).toBeInTheDocument();
  });

  it("renders currency format", () => {
    render(
      <NumberRenderer
        value={{ number: 42.5 }}
        property={makeProp({ format: "currency" })}
      />,
    );
    expect(screen.getByText("$42.50")).toBeInTheDocument();
  });

  it("renders percent format", () => {
    render(
      <NumberRenderer
        value={{ number: 0.85 }}
        property={makeProp({ format: "percent" })}
      />,
    );
    expect(screen.getByText("85%")).toBeInTheDocument();
  });

  it("falls back to value.value when value.number is absent", () => {
    render(
      <NumberRenderer value={{ value: 7 }} property={makeProp()} />,
    );
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("renders nothing for null value", () => {
    const { container } = render(
      <NumberRenderer value={{ number: null }} property={makeProp()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for empty string value", () => {
    const { container } = render(
      <NumberRenderer value={{ number: "" }} property={makeProp()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for NaN-producing value", () => {
    const { container } = render(
      <NumberRenderer value={{ number: "abc" }} property={makeProp()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders string numbers correctly", () => {
    render(
      <NumberRenderer value={{ number: "99" }} property={makeProp()} />,
    );
    expect(screen.getByText("99")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// NumberEditor
// ---------------------------------------------------------------------------

describe("NumberEditor", () => {
  it("renders an input with the current numeric value", () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <NumberEditor
        value={{ number: 42 }}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    const input = screen.getByRole("spinbutton");
    expect(input).toHaveValue(42);
  });

  it("calls onChange with { number } on input change", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <NumberEditor
        value={{ number: "" }}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    const input = screen.getByRole("spinbutton");
    await user.type(input, "5");
    expect(onChange).toHaveBeenCalledWith({ number: 5 });
  });

  it("calls onChange with null when input is cleared", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <NumberEditor
        value={{ number: 5 }}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    const input = screen.getByRole("spinbutton");
    await user.clear(input);
    expect(onChange).toHaveBeenCalledWith({ number: null });
  });

  it("calls onBlur when Enter is pressed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <NumberEditor
        value={{ number: 10 }}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    const input = screen.getByRole("spinbutton");
    await user.type(input, "{Enter}");
    expect(onBlur).toHaveBeenCalled();
  });

  it("calls onBlur when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <NumberEditor
        value={{ number: 10 }}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    const input = screen.getByRole("spinbutton");
    await user.type(input, "{Escape}");
    expect(onBlur).toHaveBeenCalled();
  });

  it("falls back to value.value when value.number is absent", () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <NumberEditor
        value={{ value: 99 }}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    expect(screen.getByRole("spinbutton")).toHaveValue(99);
  });
});
