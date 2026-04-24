import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import type { DatabaseProperty } from "@/lib/types";
import { TextRenderer, TextEditor } from "./text";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProp(overrides: Partial<DatabaseProperty> = {}): DatabaseProperty {
  return {
    id: "prop-1",
    database_id: "db-1",
    name: "Name",
    type: "text",
    config: {},
    position: 0,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// TextRenderer
// ---------------------------------------------------------------------------

describe("TextRenderer", () => {
  it("renders text from value.text", () => {
    render(<TextRenderer value={{ text: "Hello" }} property={makeProp()} />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("falls back to value.value when value.text is absent", () => {
    render(<TextRenderer value={{ value: "Fallback" }} property={makeProp()} />);
    expect(screen.getByText("Fallback")).toBeInTheDocument();
  });

  it("renders nothing for empty string", () => {
    const { container } = render(
      <TextRenderer value={{ text: "" }} property={makeProp()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when value has no text keys", () => {
    const { container } = render(
      <TextRenderer value={{}} property={makeProp()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for non-string value.text", () => {
    const { container } = render(
      <TextRenderer value={{ text: 42 }} property={makeProp()} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// TextEditor
// ---------------------------------------------------------------------------

describe("TextEditor", () => {
  it("renders an input with the current text value", () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <TextEditor
        value={{ text: "Hello" }}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("Hello");
  });

  it("calls onChange with { text } on input change", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <TextEditor
        value={{ text: "" }}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    const input = screen.getByRole("textbox");
    await user.type(input, "A");
    expect(onChange).toHaveBeenCalledWith({ text: "A" });
  });

  it("calls onBlur when Enter is pressed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <TextEditor
        value={{ text: "Hi" }}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    const input = screen.getByRole("textbox");
    await user.type(input, "{Enter}");
    expect(onBlur).toHaveBeenCalled();
  });

  it("calls onBlur when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <TextEditor
        value={{ text: "Hi" }}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    const input = screen.getByRole("textbox");
    await user.type(input, "{Escape}");
    expect(onBlur).toHaveBeenCalled();
  });

  it("falls back to value.value when value.text is absent", () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <TextEditor
        value={{ value: "Fallback" }}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("Fallback");
  });
});
