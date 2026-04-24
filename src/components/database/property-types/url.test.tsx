import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import type { DatabaseProperty } from "@/lib/types";
import { UrlRenderer, UrlEditor } from "./url";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProp(): DatabaseProperty {
  return {
    id: "prop-1",
    database_id: "db-1",
    name: "Website",
    type: "url",
    config: {},
    position: 0,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };
}

// ---------------------------------------------------------------------------
// UrlRenderer
// ---------------------------------------------------------------------------

describe("UrlRenderer", () => {
  it("renders a link with parsed hostname", () => {
    render(
      <UrlRenderer
        value={{ url: "https://example.com/path" }}
        property={makeProp()}
      />,
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://example.com/path");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveTextContent("example.com/path");
  });

  it("strips trailing slash from root URLs", () => {
    render(
      <UrlRenderer
        value={{ url: "https://example.com/" }}
        property={makeProp()}
      />,
    );
    expect(screen.getByRole("link")).toHaveTextContent("example.com");
  });

  it("falls back to raw text for invalid URLs", () => {
    render(
      <UrlRenderer
        value={{ url: "not-a-url" }}
        property={makeProp()}
      />,
    );
    expect(screen.getByRole("link")).toHaveTextContent("not-a-url");
  });

  it("falls back to value.value when value.url is absent", () => {
    render(
      <UrlRenderer
        value={{ value: "https://fallback.com" }}
        property={makeProp()}
      />,
    );
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "https://fallback.com",
    );
  });

  it("renders nothing for empty string", () => {
    const { container } = render(
      <UrlRenderer value={{ url: "" }} property={makeProp()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when value has no url keys", () => {
    const { container } = render(
      <UrlRenderer value={{}} property={makeProp()} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// UrlEditor
// ---------------------------------------------------------------------------

describe("UrlEditor", () => {
  it("renders an input with the current URL", () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <UrlEditor
        value={{ url: "https://example.com" }}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    // URL input doesn't have a specific role in jsdom, find by display value
    const input = screen.getByDisplayValue("https://example.com");
    expect(input).toBeInTheDocument();
  });

  it("calls onChange with { url } on input change", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <UrlEditor
        value={{ url: "" }}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    const input = screen.getByPlaceholderText("https://…");
    await user.type(input, "h");
    expect(onChange).toHaveBeenCalledWith({ url: "h" });
  });

  it("calls onBlur when Enter is pressed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <UrlEditor
        value={{ url: "https://x.com" }}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    const input = screen.getByDisplayValue("https://x.com");
    await user.type(input, "{Enter}");
    expect(onBlur).toHaveBeenCalled();
  });

  it("calls onBlur when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <UrlEditor
        value={{ url: "" }}
        property={makeProp()}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    const input = screen.getByPlaceholderText("https://…");
    await user.type(input, "{Escape}");
    expect(onBlur).toHaveBeenCalled();
  });
});
