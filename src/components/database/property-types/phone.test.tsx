import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import type { DatabaseProperty } from "@/lib/types";
import { PhoneRenderer, PhoneEditor } from "./phone";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProp(): DatabaseProperty {
  return {
    id: "prop-1",
    database_id: "db-1",
    name: "Phone",
    type: "phone",
    config: {},
    position: 0,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };
}

// ---------------------------------------------------------------------------
// PhoneRenderer
// ---------------------------------------------------------------------------

describe("PhoneRenderer", () => {
  it("formats a 10-digit US number", () => {
    render(
      <PhoneRenderer
        value={{ phone: "5551234567" }}
        property={makeProp()}
      />,
    );
    expect(screen.getByText("(555) 123-4567")).toBeInTheDocument();
  });

  it("formats an 11-digit US number with country code", () => {
    render(
      <PhoneRenderer
        value={{ phone: "15551234567" }}
        property={makeProp()}
      />,
    );
    expect(screen.getByText("+1 (555) 123-4567")).toBeInTheDocument();
  });

  it("renders international numbers as-is", () => {
    render(
      <PhoneRenderer
        value={{ phone: "+44 20 7946 0958" }}
        property={makeProp()}
      />,
    );
    expect(screen.getByText("+44 20 7946 0958")).toBeInTheDocument();
  });

  it("falls back to value.value when value.phone is absent", () => {
    render(
      <PhoneRenderer
        value={{ value: "1234567890" }}
        property={makeProp()}
      />,
    );
    expect(screen.getByText("(123) 456-7890")).toBeInTheDocument();
  });

  it("renders nothing for empty string", () => {
    const { container } = render(
      <PhoneRenderer value={{ phone: "" }} property={makeProp()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when value has no phone keys", () => {
    const { container } = render(
      <PhoneRenderer value={{}} property={makeProp()} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// PhoneEditor
// ---------------------------------------------------------------------------

describe("PhoneEditor", () => {
  it("renders an input with the current phone value", () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <PhoneEditor
        value={{ phone: "5551234567" }}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    expect(screen.getByDisplayValue("5551234567")).toBeInTheDocument();
  });

  it("calls onChange with { phone } on input change", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <PhoneEditor
        value={{ phone: "" }}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    const input = screen.getByPlaceholderText("+1 (555) 000-0000");
    await user.type(input, "5");
    expect(onChange).toHaveBeenCalledWith({ phone: "5" });
  });

  it("calls onBlur when Enter is pressed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <PhoneEditor
        value={{ phone: "555" }}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    const input = screen.getByDisplayValue("555");
    await user.type(input, "{Enter}");
    expect(onBlur).toHaveBeenCalled();
  });

  it("calls onBlur when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <PhoneEditor
        value={{ phone: "" }}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    const input = screen.getByPlaceholderText("+1 (555) 000-0000");
    await user.type(input, "{Escape}");
    expect(onBlur).toHaveBeenCalled();
  });
});
