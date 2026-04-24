import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DatabaseProperty } from "@/lib/types";
import { PersonRenderer, PersonEditor } from "./person";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

vi.mock("@/lib/supabase/lazy-client", () => ({
  getClient: vi.fn().mockResolvedValue({
    from: () => ({
      select: (...args: unknown[]) => {
        mockSelect(...args);
        return {
          eq: (...eqArgs: unknown[]) => {
            mockEq(...eqArgs);
            return {
              single: () => mockSingle(),
              // For members query (no .single())
              ...(() => {
                const result = mockEq(...eqArgs);
                return result;
              })(),
            };
          },
        };
      },
    }),
  }),
}));

vi.mock("@/lib/sentry", () => ({
  captureSupabaseError: vi.fn(),
  isInsufficientPrivilegeError: vi.fn().mockReturnValue(false),
}));

// Tooltip provider mock — tooltips need a provider in tests
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
    <span>{children}</span>
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MEMBERS = [
  {
    id: "user-1",
    display_name: "Alice Smith",
    email: "alice@example.com",
    avatar_url: "https://example.com/alice.jpg",
  },
  {
    id: "user-2",
    display_name: "Bob Jones",
    email: "bob@example.com",
    avatar_url: null,
  },
];

function makeProp(
  members = MEMBERS,
): DatabaseProperty {
  return {
    id: "prop-1",
    database_id: "db-1",
    name: "Assignee",
    type: "person",
    config: { _members: members },
    position: 0,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// PersonRenderer
// ---------------------------------------------------------------------------

describe("PersonRenderer", () => {
  it("renders avatar for user with avatar_url", () => {
    render(
      <PersonRenderer
        value={{ user_ids: ["user-1"] }}
        property={makeProp()}
      />,
    );
    const img = screen.getByAltText("Alice Smith");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/alice.jpg");
  });

  it("renders initials for user without avatar_url", () => {
    render(
      <PersonRenderer
        value={{ user_ids: ["user-2"] }}
        property={makeProp()}
      />,
    );
    expect(screen.getByText("BJ")).toBeInTheDocument();
  });

  it("renders multiple avatars", () => {
    render(
      <PersonRenderer
        value={{ user_ids: ["user-1", "user-2"] }}
        property={makeProp()}
      />,
    );
    expect(screen.getByAltText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("BJ")).toBeInTheDocument();
  });

  it("renders nothing when user_ids is empty", () => {
    const { container } = render(
      <PersonRenderer
        value={{ user_ids: [] }}
        property={makeProp()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when user_ids is absent", () => {
    const { container } = render(
      <PersonRenderer value={{}} property={makeProp()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("skips user_ids not found in _members", () => {
    render(
      <PersonRenderer
        value={{ user_ids: ["user-1", "nonexistent"] }}
        property={makeProp()}
      />,
    );
    expect(screen.getByAltText("Alice Smith")).toBeInTheDocument();
    // Only one avatar should render
    expect(screen.queryByText("?")).toBeNull();
  });

  it("renders tooltip with display name", () => {
    render(
      <PersonRenderer
        value={{ user_ids: ["user-1"] }}
        property={makeProp()}
      />,
    );
    // Our mocked TooltipContent renders as a span
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// PersonEditor
// ---------------------------------------------------------------------------

describe("PersonEditor", () => {
  // PersonEditor fetches members from Supabase on mount.
  // We mock the Supabase client chain for the two queries:
  // 1. pages.select("workspace_id").eq("id", database_id).single()
  // 2. members.select(...).eq("workspace_id", ...)

  it("renders a search input", async () => {
    // Mock the DB lookup to return a workspace_id
    mockSingle.mockResolvedValue({
      data: { workspace_id: "ws-1" },
      error: null,
    });
    // Mock the members query
    mockEq.mockReturnValue({
      single: () => mockSingle(),
      then: undefined,
    });

    render(
      <PersonEditor
        value={{ user_ids: [] }}
        property={makeProp()}
        onChange={vi.fn()}
        onBlur={vi.fn()}
      />,
    );

    expect(
      screen.getByPlaceholderText("Search members…"),
    ).toBeInTheDocument();
  });

  it("shows loading skeletons initially", () => {
    // Don't resolve the mock — keep it pending
    mockSingle.mockReturnValue(new Promise(() => {}));
    mockEq.mockReturnValue({
      single: () => mockSingle(),
    });

    const { container } = render(
      <PersonEditor
        value={{ user_ids: [] }}
        property={makeProp()}
        onChange={vi.fn()}
        onBlur={vi.fn()}
      />,
    );

    // Loading skeletons use animate-pulse class
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
