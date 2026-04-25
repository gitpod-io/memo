import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  DatabaseProperty,
  DatabaseRow,
} from "@/lib/types";
import { GalleryView, type GalleryViewProps } from "./gallery-view";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock next/link to render a plain <a>
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock gallery keyboard navigation — return stable no-op values
vi.mock("./gallery-keyboard", () => ({
  useGalleryKeyboardNavigation: () => ({
    focusedIndex: null,
    containerRef: { current: null },
    handleKeyDown: vi.fn(),
    handleCardFocus: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeProperty(
  overrides: Partial<DatabaseProperty> = {},
): DatabaseProperty {
  return {
    id: "prop-status",
    database_id: "db-1",
    name: "Status",
    type: "select",
    config: { options: [{ id: "opt-1", name: "Active", color: "green" }] },
    position: 0,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeRow(
  id: string,
  title: string,
  coverUrl: string | null = null,
): DatabaseRow {
  return {
    page: {
      id,
      title,
      icon: null,
      cover_url: coverUrl,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
      created_by: "user-1",
    },
    values: {},
  };
}

function defaultProps(
  overrides: Partial<GalleryViewProps> = {},
): GalleryViewProps {
  return {
    rows: [
      makeRow("row-1", "Page Alpha"),
      makeRow("row-2", "Page Beta"),
      makeRow("row-3", "Page Gamma"),
    ],
    properties: [makeProperty()],
    viewConfig: {},
    workspaceSlug: "ws",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GalleryView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Card rendering with title ---

  it("renders cards with row titles", () => {
    render(<GalleryView {...defaultProps()} />);

    expect(screen.getByText("Page Alpha")).toBeInTheDocument();
    expect(screen.getByText("Page Beta")).toBeInTheDocument();
    expect(screen.getByText("Page Gamma")).toBeInTheDocument();
  });

  it("renders 'Untitled' for rows with empty title", () => {
    const rows = [makeRow("row-1", "")];
    render(<GalleryView {...defaultProps({ rows })} />);

    expect(screen.getByText("Untitled")).toBeInTheDocument();
  });

  // --- Cover image ---

  it("renders cover image when page has cover_url", () => {
    const rows = [makeRow("row-1", "With Cover", "https://example.com/img.jpg")];
    const { container } = render(<GalleryView {...defaultProps({ rows })} />);

    // The img has alt="" so its role is "presentation" — query by tag
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "https://example.com/img.jpg");
  });

  it("renders placeholder icon when page has no cover", () => {
    const rows = [makeRow("row-1", "No Cover")];
    render(<GalleryView {...defaultProps({ rows })} />);

    // No <img> element should be present
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders cover from cover_property when configured", () => {
    const filesProp = makeProperty({
      id: "prop-files",
      name: "Cover",
      type: "files",
      config: {},
    });
    const row: DatabaseRow = {
      page: {
        id: "row-1",
        title: "File Cover",
        icon: null,
        cover_url: null,
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        created_by: "user-1",
      },
      values: {
        "prop-files": {
          id: "rv-1",
          row_id: "row-1",
          property_id: "prop-files",
          value: { files: [{ url: "https://example.com/cover.png" }] },
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        },
      },
    };

    const { container } = render(
      <GalleryView
        {...defaultProps({
          rows: [row],
          properties: [filesProp],
          viewConfig: { cover_property: "prop-files" },
        })}
      />,
    );

    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "https://example.com/cover.png");
  });

  // --- Empty state (read-only vs editable) ---

  it("shows read-only empty state when no rows and no onAddRow", () => {
    render(<GalleryView {...defaultProps({ rows: [] })} />);

    expect(screen.getByText("No pages yet")).toBeInTheDocument();
    expect(
      screen.getByText("This gallery doesn't have any pages."),
    ).toBeInTheDocument();
  });

  it("shows editable empty state with add button when onAddRow is provided", () => {
    const onAddRow = vi.fn();
    render(<GalleryView {...defaultProps({ rows: [], onAddRow })} />);

    expect(
      screen.getByText(/No pages yet — click \+ to add one/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add new page" }),
    ).toBeInTheDocument();
  });

  // --- Add-page button click ---

  it("add-page button calls onAddRow", async () => {
    const user = userEvent.setup();
    const onAddRow = vi.fn();

    render(
      <GalleryView
        {...defaultProps({
          rows: [makeRow("row-1", "Existing")],
          onAddRow,
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add new page" }));
    expect(onAddRow).toHaveBeenCalledTimes(1);
  });

  it("add-page button calls onAddRow in empty editable state", async () => {
    const user = userEvent.setup();
    const onAddRow = vi.fn();

    render(<GalleryView {...defaultProps({ rows: [], onAddRow })} />);

    await user.click(screen.getByRole("button", { name: "Add new page" }));
    expect(onAddRow).toHaveBeenCalledTimes(1);
  });

  // --- Responsive grid classes ---

  it("renders a responsive grid container", () => {
    render(<GalleryView {...defaultProps()} />);

    const container = screen.getByTestId("db-gallery-container");
    expect(container.className).toContain("grid-cols-2");
    expect(container.className).toContain("md:grid-cols-3");
    expect(container.className).toContain("lg:grid-cols-4");
  });

  // --- Card links ---

  it("cards link to the correct page URL", () => {
    render(<GalleryView {...defaultProps()} />);

    const card = screen.getByTestId("db-gallery-card-row-1");
    expect(card).toHaveAttribute("href", "/ws/row-1");
  });

  // --- Card size ---

  it("applies medium card size by default", () => {
    render(<GalleryView {...defaultProps()} />);

    const card = screen.getByTestId("db-gallery-card-row-1");
    expect(card.className).toContain("h-52");
  });

  it("applies small card size when configured", () => {
    render(
      <GalleryView
        {...defaultProps({ viewConfig: { card_size: "small" } })}
      />,
    );

    const card = screen.getByTestId("db-gallery-card-row-1");
    expect(card.className).toContain("h-40");
  });

  it("applies large card size when configured", () => {
    render(
      <GalleryView
        {...defaultProps({ viewConfig: { card_size: "large" } })}
      />,
    );

    const card = screen.getByTestId("db-gallery-card-row-1");
    expect(card.className).toContain("h-64");
  });

  // --- Loading state ---

  it("shows skeleton when loading", () => {
    const { container } = render(
      <GalleryView {...defaultProps({ loading: true })} />,
    );

    expect(screen.queryByText("Page Alpha")).not.toBeInTheDocument();
    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  // --- Gallery list role ---

  it("renders with list role and correct aria-label", () => {
    render(<GalleryView {...defaultProps()} />);

    const list = screen.getByRole("list", { name: "Database gallery" });
    expect(list).toBeInTheDocument();
  });

  // --- No add button when onAddRow is not provided ---

  it("does not render add button when onAddRow is not provided", () => {
    render(<GalleryView {...defaultProps()} />);

    expect(
      screen.queryByRole("button", { name: "Add new page" }),
    ).not.toBeInTheDocument();
  });
});
