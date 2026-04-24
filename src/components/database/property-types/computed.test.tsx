import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { DatabaseProperty } from "@/lib/types";
import {
  CreatedTimeRenderer,
  UpdatedTimeRenderer,
  CreatedByRenderer,
} from "./computed";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Tooltip provider mock
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <span className={className}>{children}</span>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="tooltip-content">{children}</span>
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTimeProp(type: "created_time" | "updated_time"): DatabaseProperty {
  return {
    id: "prop-1",
    database_id: "db-1",
    name: type === "created_time" ? "Created" : "Updated",
    type,
    config: {},
    position: 0,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };
}

function makeCreatedByProp(
  members?: Array<{
    id: string;
    display_name: string;
    avatar_url: string | null;
  }>,
): DatabaseProperty {
  return {
    id: "prop-1",
    database_id: "db-1",
    name: "Created By",
    type: "created_by",
    config: { _members: members },
    position: 0,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };
}

// ---------------------------------------------------------------------------
// CreatedTimeRenderer
// ---------------------------------------------------------------------------

describe("CreatedTimeRenderer", () => {
  let dateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Fix "now" to 2025-06-15T12:00:00Z for deterministic relative time
    dateSpy = vi.spyOn(Date, "now").mockReturnValue(
      new Date("2025-06-15T12:00:00Z").getTime(),
    );
  });

  afterEach(() => {
    dateSpy.mockRestore();
  });

  it("renders 'Just now' for very recent timestamps", () => {
    render(
      <CreatedTimeRenderer
        value={{ created_at: "2025-06-15T11:59:50Z" }}
        property={makeTimeProp("created_time")}
      />,
    );
    expect(screen.getByText("Just now")).toBeInTheDocument();
  });

  it("renders minutes ago for timestamps within the hour", () => {
    render(
      <CreatedTimeRenderer
        value={{ created_at: "2025-06-15T11:45:00Z" }}
        property={makeTimeProp("created_time")}
      />,
    );
    expect(screen.getByText("15m ago")).toBeInTheDocument();
  });

  it("renders hours ago for timestamps within the day", () => {
    render(
      <CreatedTimeRenderer
        value={{ created_at: "2025-06-15T09:00:00Z" }}
        property={makeTimeProp("created_time")}
      />,
    );
    expect(screen.getByText("3h ago")).toBeInTheDocument();
  });

  it("renders days ago for timestamps within the week", () => {
    render(
      <CreatedTimeRenderer
        value={{ created_at: "2025-06-13T12:00:00Z" }}
        property={makeTimeProp("created_time")}
      />,
    );
    expect(screen.getByText("2d ago")).toBeInTheDocument();
  });

  it("renders absolute date for older timestamps", () => {
    render(
      <CreatedTimeRenderer
        value={{ created_at: "2025-01-15T10:00:00Z" }}
        property={makeTimeProp("created_time")}
      />,
    );
    // Should render as a locale date string like "Jan 15, 2025"
    expect(screen.getByText("Jan 15, 2025")).toBeInTheDocument();
  });

  it("renders nothing when created_at is absent", () => {
    const { container } = render(
      <CreatedTimeRenderer
        value={{}}
        property={makeTimeProp("created_time")}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for empty string", () => {
    const { container } = render(
      <CreatedTimeRenderer
        value={{ created_at: "" }}
        property={makeTimeProp("created_time")}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// UpdatedTimeRenderer
// ---------------------------------------------------------------------------

describe("UpdatedTimeRenderer", () => {
  let dateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dateSpy = vi.spyOn(Date, "now").mockReturnValue(
      new Date("2025-06-15T12:00:00Z").getTime(),
    );
  });

  afterEach(() => {
    dateSpy.mockRestore();
  });

  it("renders relative time for updated_at", () => {
    render(
      <UpdatedTimeRenderer
        value={{ updated_at: "2025-06-15T11:30:00Z" }}
        property={makeTimeProp("updated_time")}
      />,
    );
    expect(screen.getByText("30m ago")).toBeInTheDocument();
  });

  it("renders nothing when updated_at is absent", () => {
    const { container } = render(
      <UpdatedTimeRenderer
        value={{}}
        property={makeTimeProp("updated_time")}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CreatedByRenderer
// ---------------------------------------------------------------------------

describe("CreatedByRenderer", () => {
  const MEMBERS = [
    {
      id: "user-1",
      display_name: "Alice Smith",
      avatar_url: "https://example.com/alice.jpg",
    },
    {
      id: "user-2",
      display_name: "Bob Jones",
      avatar_url: null,
    },
  ];

  it("renders avatar and name for a known creator", () => {
    render(
      <CreatedByRenderer
        value={{ created_by: "user-1" }}
        property={makeCreatedByProp(MEMBERS)}
      />,
    );
    const img = screen.getByAltText("Alice Smith");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/alice.jpg");
    // Name appears in both the trigger text and tooltip content
    const nameElements = screen.getAllByText("Alice Smith");
    expect(nameElements.length).toBeGreaterThanOrEqual(1);
  });

  it("renders initials for creator without avatar", () => {
    render(
      <CreatedByRenderer
        value={{ created_by: "user-2" }}
        property={makeCreatedByProp(MEMBERS)}
      />,
    );
    expect(screen.getByText("BJ")).toBeInTheDocument();
    // Name appears in both the trigger text and tooltip content
    const nameElements = screen.getAllByText("Bob Jones");
    expect(nameElements.length).toBeGreaterThanOrEqual(1);
  });

  it("renders 'Unknown' when creator is not in _members", () => {
    render(
      <CreatedByRenderer
        value={{ created_by: "nonexistent" }}
        property={makeCreatedByProp(MEMBERS)}
      />,
    );
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("renders 'Unknown' when _members is not set", () => {
    render(
      <CreatedByRenderer
        value={{ created_by: "user-1" }}
        property={makeCreatedByProp(undefined)}
      />,
    );
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("renders nothing when created_by is absent", () => {
    const { container } = render(
      <CreatedByRenderer
        value={{}}
        property={makeCreatedByProp(MEMBERS)}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for empty string created_by", () => {
    const { container } = render(
      <CreatedByRenderer
        value={{ created_by: "" }}
        property={makeCreatedByProp(MEMBERS)}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
