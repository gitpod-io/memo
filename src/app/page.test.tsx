import { describe, it, expect, vi, beforeEach } from "vitest";

// Track redirect calls — next/navigation redirect throws to halt execution
const mockRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import Home from "./page";
import { createClient } from "@/lib/supabase/server";

const mockedCreateClient = vi.mocked(createClient);

/** Build a chainable Supabase query mock that resolves to `data`. */
function buildQueryChain(data: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue({ data });
  const limit = vi.fn().mockReturnValue({ maybeSingle });
  const eq = vi.fn().mockImplementation(() => ({ eq, limit }));
  const select = vi.fn().mockReturnValue({ eq });
  return { select, eq, limit, maybeSingle };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Home (root page redirect)", () => {
  it("redirects to personal workspace when one exists", async () => {
    const personalChain = buildQueryChain({
      workspace_id: "ws-personal",
      workspaces: { slug: "my-personal" },
    });

    const mockFrom = vi.fn().mockReturnValue(personalChain);

    mockedCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
        }),
      },
      from: mockFrom,
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    await expect(Home()).rejects.toThrow("NEXT_REDIRECT:/my-personal");
    expect(mockRedirect).toHaveBeenCalledWith("/my-personal");

    // Verify the first query uses !inner join for is_personal filtering
    expect(personalChain.select).toHaveBeenCalledWith(
      "workspace_id, workspaces!inner(slug)",
    );
  });

  it("falls back to any workspace when no personal workspace exists", async () => {
    const personalChain = buildQueryChain(null);
    const fallbackChain = buildQueryChain({
      workspace_id: "ws-team",
      workspaces: { slug: "team-workspace" },
    });

    let callCount = 0;
    const mockFrom = vi.fn().mockImplementation(() => {
      callCount++;
      return callCount === 1 ? personalChain : fallbackChain;
    });

    mockedCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
        }),
      },
      from: mockFrom,
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    await expect(Home()).rejects.toThrow("NEXT_REDIRECT:/team-workspace");
    expect(mockRedirect).toHaveBeenCalledWith("/team-workspace");

    // Two queries: personal (with !inner) then fallback
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  it("renders landing page for unauthenticated users", async () => {
    mockedCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
        }),
      },
      from: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    // Should not throw (no redirect)
    const result = await Home();
    expect(result).toBeDefined();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("renders landing page when user has no workspaces", async () => {
    const emptyChain = buildQueryChain(null);
    const mockFrom = vi.fn().mockReturnValue(emptyChain);

    mockedCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
        }),
      },
      from: mockFrom,
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const result = await Home();
    expect(result).toBeDefined();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
