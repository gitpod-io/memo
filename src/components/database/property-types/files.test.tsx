import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { DatabaseProperty } from "@/lib/types";
import { FilesRenderer, FilesEditor } from "./files";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase/lazy-client", () => ({
  getClient: vi.fn().mockResolvedValue({
    storage: {
      from: () => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "https://cdn.example.com/file.png" } }),
      }),
    },
  }),
}));

vi.mock("@/lib/sentry", () => ({
  captureSupabaseError: vi.fn(),
  isInsufficientPrivilegeError: vi.fn().mockReturnValue(false),
  isSchemaNotFoundError: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/toast", () => ({
  toast: { error: vi.fn() },
}));

vi.mock("@/lib/capture", () => ({
  lazyCaptureException: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProp(): DatabaseProperty {
  return {
    id: "prop-1",
    database_id: "db-1",
    name: "Attachments",
    type: "files",
    config: {},
    position: 0,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };
}

// ---------------------------------------------------------------------------
// FilesRenderer
// ---------------------------------------------------------------------------

describe("FilesRenderer", () => {
  it("renders image thumbnails for image files", () => {
    render(
      <FilesRenderer
        value={{
          files: [
            { name: "photo.png", url: "https://cdn.example.com/photo.png" },
          ],
        }}
        property={makeProp()}
      />,
    );
    const img = screen.getByAltText("photo.png");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://cdn.example.com/photo.png");
  });

  it("renders file icon for non-image files", () => {
    const { container } = render(
      <FilesRenderer
        value={{
          files: [
            { name: "document.pdf", url: "https://cdn.example.com/doc.pdf" },
          ],
        }}
        property={makeProp()}
      />,
    );
    // FileText icon renders as an SVG
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders nothing when files array is empty", () => {
    const { container } = render(
      <FilesRenderer value={{ files: [] }} property={makeProp()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when files is absent", () => {
    const { container } = render(
      <FilesRenderer value={{}} property={makeProp()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows overflow count when more than 3 files", () => {
    render(
      <FilesRenderer
        value={{
          files: [
            { name: "a.png", url: "https://cdn.example.com/a.png" },
            { name: "b.png", url: "https://cdn.example.com/b.png" },
            { name: "c.png", url: "https://cdn.example.com/c.png" },
            { name: "d.png", url: "https://cdn.example.com/d.png" },
            { name: "e.pdf", url: "https://cdn.example.com/e.pdf" },
          ],
        }}
        property={makeProp()}
      />,
    );
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("shows max 3 visible thumbnails", () => {
    render(
      <FilesRenderer
        value={{
          files: [
            { name: "a.png", url: "https://cdn.example.com/a.png" },
            { name: "b.png", url: "https://cdn.example.com/b.png" },
            { name: "c.png", url: "https://cdn.example.com/c.png" },
            { name: "d.png", url: "https://cdn.example.com/d.png" },
          ],
        }}
        property={makeProp()}
      />,
    );
    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(3);
  });

  it("filters out invalid file entries", () => {
    const { container } = render(
      <FilesRenderer
        value={{
          files: [
            { name: 123, url: "bad" }, // invalid: name is not string
            null,
            "not-an-object",
          ],
        }}
        property={makeProp()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// FilesEditor
// ---------------------------------------------------------------------------

describe("FilesEditor", () => {
  it("renders the upload button", () => {
    render(
      <FilesEditor
        value={{ files: [] }}
        property={makeProp()}
        onChange={vi.fn()}
        onBlur={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /upload file/i }),
    ).toBeInTheDocument();
  });

  it("renders drag-and-drop hint text", () => {
    render(
      <FilesEditor
        value={{ files: [] }}
        property={makeProp()}
        onChange={vi.fn()}
        onBlur={vi.fn()}
      />,
    );
    expect(screen.getByText("or drag and drop")).toBeInTheDocument();
  });

  it("renders existing files with remove buttons", () => {
    render(
      <FilesEditor
        value={{
          files: [
            { name: "report.pdf", url: "https://cdn.example.com/report.pdf" },
          ],
        }}
        property={makeProp()}
        onChange={vi.fn()}
        onBlur={vi.fn()}
      />,
    );
    expect(screen.getByText("report.pdf")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Remove report.pdf"),
    ).toBeInTheDocument();
  });

  it("calls onChange with updated files when a file is removed", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilesEditor
        value={{
          files: [
            { name: "a.pdf", url: "https://cdn.example.com/a.pdf" },
            { name: "b.pdf", url: "https://cdn.example.com/b.pdf" },
          ],
        }}
        property={makeProp()}
        onChange={onChange}
        onBlur={vi.fn()}
      />,
    );
    await user.click(screen.getByLabelText("Remove a.pdf"));
    expect(onChange).toHaveBeenCalledWith({
      files: [{ name: "b.pdf", url: "https://cdn.example.com/b.pdf" }],
    });
  });
});
