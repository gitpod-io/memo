import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import type { DatabaseProperty } from "@/lib/types";
import { EmailRenderer, EmailEditor } from "./email";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProp(): DatabaseProperty {
  return {
    id: "prop-1",
    database_id: "db-1",
    name: "Email",
    type: "email",
    config: {},
    position: 0,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };
}

// ---------------------------------------------------------------------------
// EmailRenderer
// ---------------------------------------------------------------------------

describe("EmailRenderer", () => {
  it("renders a mailto link", () => {
    render(
      <EmailRenderer
        value={{ email: "test@example.com" }}
        property={makeProp()}
      />,
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "mailto:test@example.com");
    expect(link).toHaveTextContent("test@example.com");
  });

  it("falls back to value.value when value.email is absent", () => {
    render(
      <EmailRenderer
        value={{ value: "fallback@test.com" }}
        property={makeProp()}
      />,
    );
    expect(screen.getByRole("link")).toHaveTextContent("fallback@test.com");
  });

  it("renders nothing for empty string", () => {
    const { container } = render(
      <EmailRenderer value={{ email: "" }} property={makeProp()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when value has no email keys", () => {
    const { container } = render(
      <EmailRenderer value={{}} property={makeProp()} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// EmailEditor
// ---------------------------------------------------------------------------

describe("EmailEditor", () => {
  it("renders an input with the current email", () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <EmailEditor
        value={{ email: "a@b.com" }}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    expect(screen.getByDisplayValue("a@b.com")).toBeInTheDocument();
  });

  it("calls onChange with { email } on input change", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <EmailEditor
        value={{ email: "" }}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    const input = screen.getByPlaceholderText("name@example.com");
    await user.type(input, "x");
    expect(onChange).toHaveBeenCalledWith({ email: "x" });
  });

  it("calls onBlur when Enter is pressed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <EmailEditor
        value={{ email: "a@b.com" }}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    const input = screen.getByDisplayValue("a@b.com");
    await user.type(input, "{Enter}");
    expect(onBlur).toHaveBeenCalled();
  });

  it("calls onBlur when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <EmailEditor
        value={{ email: "" }}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    const input = screen.getByPlaceholderText("name@example.com");
    await user.type(input, "{Escape}");
    expect(onBlur).toHaveBeenCalled();
  });
});
