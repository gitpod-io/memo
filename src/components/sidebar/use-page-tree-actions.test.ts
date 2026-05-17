import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocks — declared before vi.mock so hoisted references work
// ---------------------------------------------------------------------------

const routerPushMock = vi.fn();
const routerRefreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPushMock,
    replace: vi.fn(),
    refresh: routerRefreshMock,
  }),
}));

const captureSupabaseErrorMock = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock needs flexible arity
const isForeignKeyViolationErrorMock = vi.fn((..._args: any[]) => false);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock needs flexible arity
const isInsufficientPrivilegeErrorMock = vi.fn((..._args: any[]) => false);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock needs flexible arity
const isSchemaNotFoundErrorMock = vi.fn((..._args: any[]) => false);

vi.mock("@/lib/sentry", () => ({
  captureSupabaseError: (error: unknown, op: string) =>
    captureSupabaseErrorMock(error, op),
  isForeignKeyViolationError: (error: unknown) =>
    isForeignKeyViolationErrorMock(error),
  isInsufficientPrivilegeError: (error: unknown) =>
    isInsufficientPrivilegeErrorMock(error),
  isSchemaNotFoundError: (error: unknown) =>
    isSchemaNotFoundErrorMock(error),
}));

const toastMock = vi.fn();
const toastErrorMock = vi.fn();
const toastSuccessMock = vi.fn();

vi.mock("@/lib/toast", () => ({
  toast: Object.assign(
    (...args: unknown[]) => toastMock(...args),
    {
      error: (...args: unknown[]) => toastErrorMock(...args),
      success: (...args: unknown[]) => toastSuccessMock(...args),
    },
  ),
}));

vi.mock("@/lib/track-event", () => ({
  trackEventClient: vi.fn(),
}));

const createDatabaseMock = vi.fn();
const duplicateDatabaseMock = vi.fn();

vi.mock("@/lib/database", () => ({
  createDatabase: (...args: unknown[]) => createDatabaseMock(...args),
  duplicateDatabase: (...args: unknown[]) => duplicateDatabaseMock(...args),
}));

const computeSwapPositionsMock = vi.fn();
const computeNestMock = vi.fn();
const computeUnnestMock = vi.fn();
const getDescendantIdsMock = vi.fn();
const getNextSiblingPositionMock = vi.fn();

vi.mock("@/lib/page-tree", () => ({
  computeSwapPositions: (...args: unknown[]) =>
    computeSwapPositionsMock(...args),
  computeNest: (...args: unknown[]) => computeNestMock(...args),
  computeUnnest: (...args: unknown[]) => computeUnnestMock(...args),
  getDescendantIds: (...args: unknown[]) => getDescendantIdsMock(...args),
  getNextSiblingPosition: (...args: unknown[]) =>
    getNextSiblingPositionMock(...args),
}));

// Supabase mock — chainable query builder
const supabaseRpcMock = vi.fn();
const supabaseInsertMock = vi.fn();
const supabaseUpdateMock = vi.fn();
const supabaseDeleteMock = vi.fn();
const supabaseSelectMock = vi.fn();
const supabaseEqMock = vi.fn();
const supabaseSingleMock = vi.fn();

function makeChain(terminal: ReturnType<typeof vi.fn> = supabaseSingleMock) {
  supabaseEqMock.mockReturnValue({ single: terminal });
  supabaseSelectMock.mockReturnValue({ eq: supabaseEqMock, single: terminal });
  supabaseInsertMock.mockReturnValue({ select: supabaseSelectMock });
  supabaseUpdateMock.mockReturnValue({ eq: supabaseEqMock });
  supabaseDeleteMock.mockReturnValue({ eq: supabaseEqMock });
  return {
    from: (table: string) => {
      void table;
      return {
        insert: supabaseInsertMock,
        update: supabaseUpdateMock,
        delete: () => supabaseDeleteMock(),
        select: supabaseSelectMock,
      };
    },
    rpc: supabaseRpcMock,
  };
}

let supabaseMock: ReturnType<typeof makeChain>;

vi.mock("@/lib/supabase/lazy-client", () => ({
  getClient: vi.fn().mockImplementation(async () => supabaseMock),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { usePageTreeActions } from "./use-page-tree-actions";
import type { SidebarPage } from "@/lib/types";
import type { TreeNode } from "@/lib/page-tree";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePage(overrides: Partial<SidebarPage> = {}): SidebarPage {
  return {
    id: "page-1",
    workspace_id: "ws-1",
    parent_id: null,
    title: "Test Page",
    icon: null,
    cover_url: null,
    is_database: false,
    position: 0,
    created_by: "user-1",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

function makeTreeNode(page: SidebarPage, children: TreeNode[] = []): TreeNode {
  return { page, children };
}

function setup(overrides?: Partial<Parameters<typeof usePageTreeActions>[0]>) {
  const pages = overrides?.pages ?? [makePage()];
  const setPages = vi.fn((updater) => {
    if (typeof updater === "function") return updater(pages);
    return updater;
  });
  const setFavoriteMap = vi.fn((updater) => {
    if (typeof updater === "function")
      return updater(overrides?.favoriteMap ?? new Map());
    return updater;
  });
  const setExpanded = vi.fn((updater) => {
    if (typeof updater === "function") return updater(new Set<string>());
    return updater;
  });
  const removeFromPersisted = vi.fn();

  const params = {
    workspaceId: "ws-1",
    workspaceSlug: "test-ws",
    userId: "user-1",
    pages,
    setPages,
    favoriteMap: new Map<string, string>(),
    setFavoriteMap,
    setExpanded,
    removeFromPersisted,
    currentPageId: undefined as string | undefined,
    ...overrides,
  };

  const hookResult = renderHook(() => usePageTreeActions(params));
  return { ...hookResult, setPages, setFavoriteMap, setExpanded, removeFromPersisted, params };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("usePageTreeActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock = makeChain();
    getNextSiblingPositionMock.mockReturnValue(1);
    getDescendantIdsMock.mockReturnValue([]);
    // Reset error classifiers to return false (not a known error type)
    isForeignKeyViolationErrorMock.mockReturnValue(false);
    isInsufficientPrivilegeErrorMock.mockReturnValue(false);
    isSchemaNotFoundErrorMock.mockReturnValue(false);
  });

  // -------------------------------------------------------------------------
  // handleCreate
  // -------------------------------------------------------------------------

  describe("handleCreate", () => {
    it("inserts a page and navigates on success", async () => {
      const newPage = makePage({ id: "new-1", title: "" });
      supabaseSingleMock.mockResolvedValue({ data: newPage, error: null });

      const { result } = setup();

      await act(async () => {
        await result.current.handleCreate(null);
      });

      expect(supabaseInsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          workspace_id: "ws-1",
          parent_id: null,
          title: "",
          created_by: "user-1",
        }),
      );
      expect(routerPushMock).toHaveBeenCalledWith("/test-ws/new-1");
    });

    it("expands parent when creating a child page", async () => {
      const newPage = makePage({ id: "new-1", parent_id: "parent-1" });
      supabaseSingleMock.mockResolvedValue({ data: newPage, error: null });

      const { result, setExpanded } = setup();

      await act(async () => {
        await result.current.handleCreate("parent-1");
      });

      expect(setExpanded).toHaveBeenCalled();
      const updater = setExpanded.mock.calls[0][0];
      const expanded = updater(new Set<string>());
      expect(expanded.has("parent-1")).toBe(true);
    });

    it("shows error toast on FK violation without capturing to Sentry", async () => {
      const error = { code: "23503", message: "FK violation" };
      supabaseSingleMock.mockResolvedValue({ data: null, error });
      isForeignKeyViolationErrorMock.mockReturnValue(true);

      const { result } = setup();

      await act(async () => {
        await result.current.handleCreate(null);
      });

      expect(toastErrorMock).toHaveBeenCalledWith("Failed to create page", expect.any(Object));
      expect(captureSupabaseErrorMock).not.toHaveBeenCalled();
      expect(routerPushMock).not.toHaveBeenCalled();
    });

    it("shows error toast on insufficient privilege without capturing to Sentry", async () => {
      const error = { code: "42501", message: "insufficient privilege" };
      supabaseSingleMock.mockResolvedValue({ data: null, error });
      isInsufficientPrivilegeErrorMock.mockReturnValue(true);

      const { result } = setup();

      await act(async () => {
        await result.current.handleCreate(null);
      });

      expect(toastErrorMock).toHaveBeenCalledWith("Failed to create page", expect.any(Object));
      expect(captureSupabaseErrorMock).not.toHaveBeenCalled();
    });

    it("captures unknown errors to Sentry", async () => {
      const error = { code: "XXXXX", message: "unknown error" };
      supabaseSingleMock.mockResolvedValue({ data: null, error });

      const { result } = setup();

      await act(async () => {
        await result.current.handleCreate(null);
      });

      expect(captureSupabaseErrorMock).toHaveBeenCalledWith(error, "page-tree:create-page");
      expect(toastErrorMock).toHaveBeenCalled();
    });

    it("does nothing when workspaceId is null", async () => {
      const { result } = setup({ workspaceId: null });

      await act(async () => {
        await result.current.handleCreate(null);
      });

      expect(supabaseInsertMock).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // handleCreateDatabase
  // -------------------------------------------------------------------------

  describe("handleCreateDatabase", () => {
    it("creates a database and navigates on success", async () => {
      const dbPage = makePage({ id: "db-1", is_database: true, title: "Untitled Database" });
      createDatabaseMock.mockResolvedValue({ data: { page: dbPage }, error: null });

      const { result, setPages } = setup();

      await act(async () => {
        await result.current.handleCreateDatabase();
      });

      expect(createDatabaseMock).toHaveBeenCalledWith("ws-1", "user-1");
      expect(setPages).toHaveBeenCalled();
      expect(routerPushMock).toHaveBeenCalledWith("/test-ws/db-1");
      expect(routerRefreshMock).toHaveBeenCalled();
    });

    it("shows error toast on failure", async () => {
      const error = { code: "XXXXX", message: "db error" };
      createDatabaseMock.mockResolvedValue({ data: null, error });

      const { result } = setup();

      await act(async () => {
        await result.current.handleCreateDatabase();
      });

      expect(toastErrorMock).toHaveBeenCalledWith("Failed to create database", expect.any(Object));
      expect(captureSupabaseErrorMock).toHaveBeenCalledWith(error, "page-tree:create-database");
      expect(routerPushMock).not.toHaveBeenCalled();
    });

    it("does not capture insufficient privilege errors to Sentry", async () => {
      const error = { code: "42501", message: "insufficient privilege" };
      isInsufficientPrivilegeErrorMock.mockReturnValue(true);
      createDatabaseMock.mockResolvedValue({ data: null, error });

      const { result } = setup();

      await act(async () => {
        await result.current.handleCreateDatabase();
      });

      expect(toastErrorMock).toHaveBeenCalled();
      expect(captureSupabaseErrorMock).not.toHaveBeenCalled();
    });

    it("does nothing when workspaceId is null", async () => {
      const { result } = setup({ workspaceId: null });

      await act(async () => {
        await result.current.handleCreateDatabase();
      });

      expect(createDatabaseMock).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // handleDuplicate
  // -------------------------------------------------------------------------

  describe("handleDuplicate", () => {
    it("duplicates a regular page and navigates", async () => {
      const page = makePage({ id: "page-1", title: "My Page" });
      // Mock the content fetch
      const contentSelectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { content: { blocks: [] } }, error: null }),
        }),
      });
      // Mock the insert for the duplicate
      const dupPage = makePage({ id: "dup-1", title: "My Page (copy)" });
      const dupSingleMock = vi.fn().mockResolvedValue({ data: dupPage, error: null });
      const dupSelectMock = vi.fn().mockReturnValue({ single: dupSingleMock });
      const dupInsertMock = vi.fn().mockReturnValue({ select: dupSelectMock });

      supabaseMock = {
        from: (table: string) => {
          void table;
          return {
            insert: dupInsertMock,
            update: supabaseUpdateMock,
            delete: () => supabaseDeleteMock(),
            select: contentSelectMock,
          };
        },
        rpc: supabaseRpcMock,
      };

      const { result, setPages } = setup({ pages: [page] });

      await act(async () => {
        await result.current.handleDuplicate(page);
      });

      expect(setPages).toHaveBeenCalled();
      expect(toastSuccessMock).toHaveBeenCalledWith("Page duplicated");
      expect(routerPushMock).toHaveBeenCalledWith("/test-ws/dup-1");
    });

    it("duplicates a database page using duplicateDatabase", async () => {
      const dbPage = makePage({ id: "db-1", title: "My DB", is_database: true });
      // Mock content fetch
      const contentSelectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { content: null }, error: null }),
        }),
      });
      supabaseMock = {
        from: () => ({
          insert: supabaseInsertMock,
          update: supabaseUpdateMock,
          delete: () => supabaseDeleteMock(),
          select: contentSelectMock,
        }),
        rpc: supabaseRpcMock,
      };

      const newDbPage = makePage({ id: "dup-db-1", title: "My DB (copy)", is_database: true });
      duplicateDatabaseMock.mockResolvedValue({ data: newDbPage, error: null });

      const { result, setPages } = setup({ pages: [dbPage] });

      await act(async () => {
        await result.current.handleDuplicate(dbPage);
      });

      expect(duplicateDatabaseMock).toHaveBeenCalled();
      expect(setPages).toHaveBeenCalled();
      expect(toastSuccessMock).toHaveBeenCalledWith("Database duplicated");
      expect(routerPushMock).toHaveBeenCalledWith("/test-ws/dup-db-1");
      expect(routerRefreshMock).toHaveBeenCalled();
    });

    it("shows error toast when regular page duplication fails", async () => {
      const page = makePage({ id: "page-1", title: "My Page" });
      const contentSelectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { content: null }, error: null }),
        }),
      });
      const error = { code: "XXXXX", message: "insert failed" };
      const dupSingleMock = vi.fn().mockResolvedValue({ data: null, error });
      const dupSelectMock = vi.fn().mockReturnValue({ single: dupSingleMock });
      const dupInsertMock = vi.fn().mockReturnValue({ select: dupSelectMock });

      supabaseMock = {
        from: () => ({
          insert: dupInsertMock,
          update: supabaseUpdateMock,
          delete: () => supabaseDeleteMock(),
          select: contentSelectMock,
        }),
        rpc: supabaseRpcMock,
      };

      const { result } = setup({ pages: [page] });

      await act(async () => {
        await result.current.handleDuplicate(page);
      });

      expect(captureSupabaseErrorMock).toHaveBeenCalledWith(error, "page-tree:duplicate-page");
      expect(toastErrorMock).toHaveBeenCalledWith("Failed to duplicate page", expect.any(Object));
    });

    it("shows error toast when database duplication fails", async () => {
      const dbPage = makePage({ id: "db-1", title: "My DB", is_database: true });
      const contentSelectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { content: null }, error: null }),
        }),
      });
      supabaseMock = {
        from: () => ({
          insert: supabaseInsertMock,
          update: supabaseUpdateMock,
          delete: () => supabaseDeleteMock(),
          select: contentSelectMock,
        }),
        rpc: supabaseRpcMock,
      };

      const error = { code: "XXXXX", message: "dup failed" };
      duplicateDatabaseMock.mockResolvedValue({ data: null, error });

      const { result } = setup({ pages: [dbPage] });

      await act(async () => {
        await result.current.handleDuplicate(dbPage);
      });

      expect(captureSupabaseErrorMock).toHaveBeenCalledWith(error, "page-tree:duplicate-database");
      expect(toastErrorMock).toHaveBeenCalledWith("Failed to duplicate database", expect.any(Object));
    });
  });

  // -------------------------------------------------------------------------
  // handleDelete
  // -------------------------------------------------------------------------

  describe("handleDelete", () => {
    it("soft-deletes a page and removes it from state", async () => {
      const page = makePage({ id: "page-1" });
      const node = makeTreeNode(page);
      supabaseRpcMock.mockResolvedValue({ error: null });

      const { result, setPages, removeFromPersisted } = setup({ pages: [page] });

      await act(async () => {
        await result.current.handleDelete(node);
      });

      expect(supabaseRpcMock).toHaveBeenCalledWith("soft_delete_page", { page_id: "page-1" });
      expect(setPages).toHaveBeenCalled();
      expect(removeFromPersisted).toHaveBeenCalled();
      expect(toastMock).toHaveBeenCalledWith("Page moved to trash", expect.any(Object));
    });

    it("removes descendants from state", async () => {
      const parent = makePage({ id: "parent-1" });
      const child = makePage({ id: "child-1", parent_id: "parent-1" });
      const parentNode = makeTreeNode(parent, [makeTreeNode(child)]);
      getDescendantIdsMock.mockReturnValue(["child-1"]);
      supabaseRpcMock.mockResolvedValue({ error: null });

      const { result, setPages, removeFromPersisted } = setup({ pages: [parent, child] });

      await act(async () => {
        await result.current.handleDelete(parentNode);
      });

      // setPages updater should filter out both parent and child
      const updater = setPages.mock.calls[0][0];
      const remaining = updater([parent, child]);
      expect(remaining).toHaveLength(0);

      // removeFromPersisted should receive both IDs
      const removedIds = removeFromPersisted.mock.calls[0][0] as Set<string>;
      expect(removedIds.has("parent-1")).toBe(true);
      expect(removedIds.has("child-1")).toBe(true);
    });

    it("navigates to workspace root when deleting the current page", async () => {
      const page = makePage({ id: "page-1" });
      const node = makeTreeNode(page);
      supabaseRpcMock.mockResolvedValue({ error: null });

      const { result } = setup({ pages: [page], currentPageId: "page-1" });

      await act(async () => {
        await result.current.handleDelete(node);
      });

      expect(routerPushMock).toHaveBeenCalledWith("/test-ws");
    });

    it("does not navigate when deleting a different page", async () => {
      const page = makePage({ id: "page-1" });
      const node = makeTreeNode(page);
      supabaseRpcMock.mockResolvedValue({ error: null });

      const { result } = setup({ pages: [page], currentPageId: "other-page" });

      await act(async () => {
        await result.current.handleDelete(node);
      });

      expect(routerPushMock).not.toHaveBeenCalled();
    });

    it("shows error toast on failure", async () => {
      const page = makePage({ id: "page-1" });
      const node = makeTreeNode(page);
      const error = { code: "XXXXX", message: "rpc failed" };
      supabaseRpcMock.mockResolvedValue({ error });

      const { result, setPages } = setup({ pages: [page] });

      await act(async () => {
        await result.current.handleDelete(node);
      });

      expect(captureSupabaseErrorMock).toHaveBeenCalledWith(error, "page-tree:soft-delete-page");
      expect(toastErrorMock).toHaveBeenCalledWith("Failed to delete page", expect.any(Object));
      expect(setPages).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // handleMoveUp / handleMoveDown
  // -------------------------------------------------------------------------

  describe("handleMoveUp", () => {
    it("swaps positions via computeSwapPositions", async () => {
      const pageA = makePage({ id: "a", position: 0 });
      const pageB = makePage({ id: "b", position: 1 });
      computeSwapPositionsMock.mockReturnValue({
        updates: [
          { id: "b", position: 0 },
          { id: "a", position: 1 },
        ],
      });
      supabaseEqMock.mockResolvedValue({ error: null });

      const { result, setPages } = setup({ pages: [pageA, pageB] });

      await act(async () => {
        await result.current.handleMoveUp(pageB);
      });

      expect(computeSwapPositionsMock).toHaveBeenCalledWith([pageA, pageB], "b", "up");
      expect(setPages).toHaveBeenCalled();
    });

    it("does nothing when already at top (computeSwapPositions returns null)", async () => {
      const page = makePage({ id: "a", position: 0 });
      computeSwapPositionsMock.mockReturnValue(null);

      const { result, setPages } = setup({ pages: [page] });

      await act(async () => {
        await result.current.handleMoveUp(page);
      });

      expect(setPages).not.toHaveBeenCalled();
    });

    it("captures error to Sentry when swap DB update fails", async () => {
      const pageA = makePage({ id: "a", position: 0 });
      const pageB = makePage({ id: "b", position: 1 });
      computeSwapPositionsMock.mockReturnValue({
        updates: [
          { id: "b", position: 0 },
          { id: "a", position: 1 },
        ],
      });
      const error = { code: "XXXXX", message: "update failed" };
      supabaseEqMock.mockResolvedValue({ error });

      const { result } = setup({ pages: [pageA, pageB] });

      await act(async () => {
        await result.current.handleMoveUp(pageB);
      });

      expect(captureSupabaseErrorMock).toHaveBeenCalledWith(error, "page-tree:swap-positions");
      expect(toastErrorMock).toHaveBeenCalledWith("Failed to reorder page", expect.any(Object));
    });
  });

  describe("handleMoveDown", () => {
    it("swaps positions downward", async () => {
      const pageA = makePage({ id: "a", position: 0 });
      const pageB = makePage({ id: "b", position: 1 });
      computeSwapPositionsMock.mockReturnValue({
        updates: [
          { id: "a", position: 1 },
          { id: "b", position: 0 },
        ],
      });
      supabaseEqMock.mockResolvedValue({ error: null });

      const { result, setPages } = setup({ pages: [pageA, pageB] });

      await act(async () => {
        await result.current.handleMoveDown(pageA);
      });

      expect(computeSwapPositionsMock).toHaveBeenCalledWith([pageA, pageB], "a", "down");
      expect(setPages).toHaveBeenCalled();
    });

    it("does nothing when already at bottom", async () => {
      const page = makePage({ id: "a", position: 0 });
      computeSwapPositionsMock.mockReturnValue(null);

      const { result, setPages } = setup({ pages: [page] });

      await act(async () => {
        await result.current.handleMoveDown(page);
      });

      expect(setPages).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // handleNest
  // -------------------------------------------------------------------------

  describe("handleNest", () => {
    it("updates parent_id and position, expands new parent", async () => {
      const pageA = makePage({ id: "a", position: 0 });
      const pageB = makePage({ id: "b", position: 1 });
      computeNestMock.mockReturnValue({ parentId: "a", position: 0 });
      supabaseEqMock.mockResolvedValue({ error: null });

      const { result, setPages, setExpanded } = setup({ pages: [pageA, pageB] });

      await act(async () => {
        await result.current.handleNest(pageB);
      });

      expect(computeNestMock).toHaveBeenCalledWith([pageA, pageB], "b");
      expect(setPages).toHaveBeenCalled();

      // Verify optimistic update sets parent_id
      const updater = setPages.mock.calls[0][0];
      const updated = updater([pageA, pageB]);
      const nested = updated.find((p: SidebarPage) => p.id === "b");
      expect(nested.parent_id).toBe("a");
      expect(nested.position).toBe(0);

      // Verify expanded state includes new parent
      expect(setExpanded).toHaveBeenCalled();
      const expandUpdater = setExpanded.mock.calls[0][0];
      const expandedSet = expandUpdater(new Set<string>());
      expect(expandedSet.has("a")).toBe(true);
    });

    it("does nothing when computeNest returns null (first sibling)", async () => {
      const page = makePage({ id: "a", position: 0 });
      computeNestMock.mockReturnValue(null);

      const { result, setPages } = setup({ pages: [page] });

      await act(async () => {
        await result.current.handleNest(page);
      });

      expect(setPages).not.toHaveBeenCalled();
    });

    it("captures error to Sentry on DB failure", async () => {
      const pageA = makePage({ id: "a", position: 0 });
      const pageB = makePage({ id: "b", position: 1 });
      computeNestMock.mockReturnValue({ parentId: "a", position: 0 });
      const error = { code: "XXXXX", message: "update failed" };
      supabaseEqMock.mockResolvedValue({ error });

      const { result } = setup({ pages: [pageA, pageB] });

      await act(async () => {
        await result.current.handleNest(pageB);
      });

      expect(captureSupabaseErrorMock).toHaveBeenCalledWith(error, "page-tree:nest-page");
      expect(toastErrorMock).toHaveBeenCalledWith("Failed to nest page", expect.any(Object));
    });
  });

  // -------------------------------------------------------------------------
  // handleUnnest
  // -------------------------------------------------------------------------

  describe("handleUnnest", () => {
    it("updates parent_id, position, and shifts siblings", async () => {
      const parent = makePage({ id: "parent", position: 0, parent_id: null });
      const child = makePage({ id: "child", position: 0, parent_id: "parent" });
      const sibling = makePage({ id: "sibling", position: 1, parent_id: null });
      computeUnnestMock.mockReturnValue({
        pageUpdate: { parentId: null, position: 1 },
        shiftUpdates: [{ id: "sibling", position: 2 }],
      });
      supabaseEqMock.mockResolvedValue({ error: null });

      const pages = [parent, child, sibling];
      const { result, setPages } = setup({ pages });

      await act(async () => {
        await result.current.handleUnnest(child);
      });

      expect(computeUnnestMock).toHaveBeenCalledWith(pages, "child");
      expect(setPages).toHaveBeenCalled();

      // Verify optimistic update
      const updater = setPages.mock.calls[0][0];
      const updated = updater(pages);
      const unnested = updated.find((p: SidebarPage) => p.id === "child");
      expect(unnested.parent_id).toBeNull();
      expect(unnested.position).toBe(1);
      const shifted = updated.find((p: SidebarPage) => p.id === "sibling");
      expect(shifted.position).toBe(2);
    });

    it("does nothing when computeUnnest returns null (no parent)", async () => {
      const page = makePage({ id: "a", position: 0, parent_id: null });
      computeUnnestMock.mockReturnValue(null);

      const { result, setPages } = setup({ pages: [page] });

      await act(async () => {
        await result.current.handleUnnest(page);
      });

      expect(setPages).not.toHaveBeenCalled();
    });

    it("captures error to Sentry on DB failure", async () => {
      const parent = makePage({ id: "parent", position: 0 });
      const child = makePage({ id: "child", position: 0, parent_id: "parent" });
      computeUnnestMock.mockReturnValue({
        pageUpdate: { parentId: null, position: 1 },
        shiftUpdates: [],
      });
      const error = { code: "XXXXX", message: "update failed" };
      supabaseEqMock.mockResolvedValue({ error });

      const { result } = setup({ pages: [parent, child] });

      await act(async () => {
        await result.current.handleUnnest(child);
      });

      expect(captureSupabaseErrorMock).toHaveBeenCalledWith(error, "page-tree:unnest-page");
      expect(toastErrorMock).toHaveBeenCalledWith("Failed to unnest page", expect.any(Object));
    });
  });

  // -------------------------------------------------------------------------
  // handleToggleFavorite
  // -------------------------------------------------------------------------

  describe("handleToggleFavorite", () => {
    it("adds a favorite on success", async () => {
      const insertSingleMock = vi.fn().mockResolvedValue({
        data: { id: "fav-1" },
        error: null,
      });
      const insertSelectMock = vi.fn().mockReturnValue({ single: insertSingleMock });
      const insertMock = vi.fn().mockReturnValue({ select: insertSelectMock });

      supabaseMock = {
        from: () => ({
          insert: insertMock,
          update: supabaseUpdateMock,
          delete: () => supabaseDeleteMock(),
          select: supabaseSelectMock,
        }),
        rpc: supabaseRpcMock,
      };

      const { result, setFavoriteMap } = setup({
        favoriteMap: new Map<string, string>(),
      });

      await act(async () => {
        await result.current.handleToggleFavorite("page-1");
      });

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          workspace_id: "ws-1",
          user_id: "user-1",
          page_id: "page-1",
        }),
      );
      expect(setFavoriteMap).toHaveBeenCalled();
    });

    it("removes a favorite optimistically and reverts on error", async () => {
      const deleteEqMock = vi.fn();
      const error = { code: "XXXXX", message: "delete failed" };
      deleteEqMock.mockResolvedValue({ error });
      const deleteMock = vi.fn().mockReturnValue({ eq: deleteEqMock });

      supabaseMock = {
        from: () => ({
          insert: supabaseInsertMock,
          update: supabaseUpdateMock,
          delete: () => deleteMock(),
          select: supabaseSelectMock,
        }),
        rpc: supabaseRpcMock,
      };

      const favoriteMap = new Map<string, string>([["page-1", "fav-1"]]);
      const { result, setFavoriteMap } = setup({ favoriteMap });

      await act(async () => {
        await result.current.handleToggleFavorite("page-1");
      });

      // First call: optimistic removal
      expect(setFavoriteMap).toHaveBeenCalled();
      const optimisticUpdater = setFavoriteMap.mock.calls[0][0];
      const optimistic = optimisticUpdater(favoriteMap);
      expect(optimistic.has("page-1")).toBe(false);

      // Error should trigger revert and toast
      expect(toastErrorMock).toHaveBeenCalledWith("Failed to remove favorite", expect.any(Object));
      // Second call: revert
      expect(setFavoriteMap.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it("removes a favorite successfully", async () => {
      const deleteEqMock = vi.fn().mockResolvedValue({ error: null });
      const deleteMock = vi.fn().mockReturnValue({ eq: deleteEqMock });

      supabaseMock = {
        from: () => ({
          insert: supabaseInsertMock,
          update: supabaseUpdateMock,
          delete: () => deleteMock(),
          select: supabaseSelectMock,
        }),
        rpc: supabaseRpcMock,
      };

      const favoriteMap = new Map<string, string>([["page-1", "fav-1"]]);
      const { result, setFavoriteMap } = setup({ favoriteMap });

      await act(async () => {
        await result.current.handleToggleFavorite("page-1");
      });

      // Optimistic removal only, no revert
      expect(setFavoriteMap).toHaveBeenCalledTimes(1);
      expect(toastErrorMock).not.toHaveBeenCalled();
    });

    it("shows error toast when adding favorite fails", async () => {
      const error = { code: "XXXXX", message: "insert failed" };
      const insertSingleMock = vi.fn().mockResolvedValue({ data: null, error });
      const insertSelectMock = vi.fn().mockReturnValue({ single: insertSingleMock });
      const insertMock = vi.fn().mockReturnValue({ select: insertSelectMock });

      supabaseMock = {
        from: () => ({
          insert: insertMock,
          update: supabaseUpdateMock,
          delete: () => supabaseDeleteMock(),
          select: supabaseSelectMock,
        }),
        rpc: supabaseRpcMock,
      };

      const { result } = setup({ favoriteMap: new Map<string, string>() });

      await act(async () => {
        await result.current.handleToggleFavorite("page-1");
      });

      expect(captureSupabaseErrorMock).toHaveBeenCalledWith(error, "page-tree:add-favorite");
      expect(toastErrorMock).toHaveBeenCalledWith("Failed to add favorite", expect.any(Object));
    });

    it("does nothing when workspaceId is null", async () => {
      const { result, setFavoriteMap } = setup({ workspaceId: null });

      await act(async () => {
        await result.current.handleToggleFavorite("page-1");
      });

      expect(setFavoriteMap).not.toHaveBeenCalled();
    });
  });
});
