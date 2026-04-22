import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const captureSupabaseErrorMock = vi.fn();

vi.mock("@/lib/sentry", () => ({
  captureSupabaseError: (error: unknown, operation: unknown) =>
    captureSupabaseErrorMock(error, operation),
}));

/**
 * Creates a chainable Supabase query builder mock.
 * Every method returns the builder itself. The builder is thenable,
 * so `await supabase.from("x").update({}).eq(...)` resolves to `resolvedValue`.
 * `.single()` and `.maybeSingle()` also resolve to `resolvedValue`.
 */
function createChainMock(resolvedValue: {
  data: unknown;
  error: unknown;
  count?: number | null;
}) {
  const calls: Record<string, unknown[][]> = {};

  const handler: ProxyHandler<object> = {
    get(_target, prop: string) {
      // Make the proxy thenable so bare `await chain` works
      if (prop === "then") {
        return (
          resolve: (v: unknown) => void,
          reject?: (e: unknown) => void,
        ) => Promise.resolve(resolvedValue).then(resolve, reject);
      }
      if (prop === "catch" || prop === "finally") {
        return (...args: unknown[]) =>
          Promise.resolve(resolvedValue)[prop as "catch" | "finally"](
            ...(args as [never]),
          );
      }

      // Track calls for assertions
      return (...args: unknown[]) => {
        if (!calls[prop]) calls[prop] = [];
        calls[prop].push(args);
        return proxy;
      };
    },
  };

  const proxy = new Proxy({}, handler);
  return { proxy, calls };
}

// Per-table mock registry.
let tableMocks: Record<string, ReturnType<typeof createChainMock>>;

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => {
      const mock = tableMocks[table];
      if (!mock) throw new Error(`No mock configured for table: ${table}`);
      return mock.proxy;
    },
  }),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import {
  createDatabase,
  deleteDatabase,
  addProperty,
  updateProperty,
  deleteProperty,
  reorderProperties,
  addRow,
  updateRowValue,
  addView,
  updateView,
  deleteView,
  reorderViews,
  loadDatabase,
  loadRow,
} from "./database";

beforeEach(() => {
  vi.clearAllMocks();
  tableMocks = {};
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockTable(
  table: string,
  resolvedValue: { data: unknown; error: unknown; count?: number | null },
) {
  const mock = createChainMock(resolvedValue);
  tableMocks[table] = mock;
  return mock;
}

const FAKE_PAGE = {
  id: "page-1",
  workspace_id: "ws-1",
  parent_id: null,
  title: "Test DB",
  content: null,
  icon: null,
  cover_url: null,
  is_database: true,
  position: 0,
  created_by: "user-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
};

const FAKE_PROPERTY = {
  id: "prop-1",
  database_id: "page-1",
  name: "Title",
  type: "text",
  config: {},
  position: 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const FAKE_VIEW = {
  id: "view-1",
  database_id: "page-1",
  name: "Default view",
  type: "table",
  config: {},
  position: 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

// ---------------------------------------------------------------------------
// createDatabase
// ---------------------------------------------------------------------------

describe("createDatabase", () => {
  it("creates page, default property, and default view", async () => {
    mockTable("pages", { data: FAKE_PAGE, error: null });
    mockTable("database_properties", { data: FAKE_PROPERTY, error: null });
    mockTable("database_views", { data: FAKE_VIEW, error: null });

    const result = await createDatabase("ws-1", "user-1", "Test DB");

    expect(result.error).toBeNull();
    expect(result.data).not.toBeNull();
    expect(result.data!.page.id).toBe("page-1");
    expect(result.data!.property.name).toBe("Title");
    expect(result.data!.view.type).toBe("table");
  });

  it("returns error and captures to Sentry when page insert fails", async () => {
    const dbError = new Error("RLS violation");
    mockTable("pages", { data: null, error: dbError });

    const result = await createDatabase("ws-1", "user-1");

    expect(result.error).toBe(dbError);
    expect(result.data).toBeNull();
    expect(captureSupabaseErrorMock).toHaveBeenCalledWith(
      dbError,
      "database.create:page",
    );
  });

  it("cleans up page when property insert fails", async () => {
    mockTable("pages", { data: FAKE_PAGE, error: null });
    const propError = new Error("property insert failed");
    mockTable("database_properties", { data: null, error: propError });

    const result = await createDatabase("ws-1", "user-1");

    expect(result.error).toBe(propError);
    expect(captureSupabaseErrorMock).toHaveBeenCalledWith(
      propError,
      "database.create:property",
    );
    expect(tableMocks["pages"].calls["delete"]).toBeDefined();
  });

  it("cleans up page when view insert fails", async () => {
    mockTable("pages", { data: FAKE_PAGE, error: null });
    mockTable("database_properties", { data: FAKE_PROPERTY, error: null });
    const viewError = new Error("view insert failed");
    mockTable("database_views", { data: null, error: viewError });

    const result = await createDatabase("ws-1", "user-1");

    expect(result.error).toBe(viewError);
    expect(captureSupabaseErrorMock).toHaveBeenCalledWith(
      viewError,
      "database.create:view",
    );
    expect(tableMocks["pages"].calls["delete"]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// deleteDatabase
// ---------------------------------------------------------------------------

describe("deleteDatabase", () => {
  it("soft-deletes the database page", async () => {
    mockTable("pages", { data: null, error: null });

    const result = await deleteDatabase("page-1");

    expect(result.error).toBeNull();
    expect(tableMocks["pages"].calls["update"]).toBeDefined();
    const eqCalls = tableMocks["pages"].calls["eq"];
    expect(eqCalls).toContainEqual(["id", "page-1"]);
    expect(eqCalls).toContainEqual(["is_database", true]);
  });

  it("captures error on failure", async () => {
    const dbError = new Error("delete failed");
    mockTable("pages", { data: null, error: dbError });

    const result = await deleteDatabase("page-1");

    expect(result.error).toBe(dbError);
    expect(captureSupabaseErrorMock).toHaveBeenCalledWith(
      dbError,
      "database.delete",
    );
  });
});

// ---------------------------------------------------------------------------
// addProperty
// ---------------------------------------------------------------------------

describe("addProperty", () => {
  it("inserts a property with auto-calculated position", async () => {
    mockTable("database_properties", {
      data: { ...FAKE_PROPERTY, id: "prop-new", position: 3 },
      error: null,
    });

    const result = await addProperty("page-1", "Status", "select", {
      options: [],
    });

    expect(result.error).toBeNull();
    expect(result.data).not.toBeNull();
    expect(tableMocks["database_properties"].calls["insert"]).toBeDefined();
  });

  it("captures error on failure", async () => {
    const dbError = new Error("duplicate name");
    mockTable("database_properties", { data: null, error: dbError });

    const result = await addProperty("page-1", "Title", "text");

    expect(result.error).toBe(dbError);
    expect(captureSupabaseErrorMock).toHaveBeenCalledWith(
      dbError,
      "database.addProperty",
    );
  });
});

// ---------------------------------------------------------------------------
// updateProperty
// ---------------------------------------------------------------------------

describe("updateProperty", () => {
  it("updates property name", async () => {
    const updated = { ...FAKE_PROPERTY, name: "New Name" };
    mockTable("database_properties", { data: updated, error: null });

    const result = await updateProperty("prop-1", { name: "New Name" });

    expect(result.error).toBeNull();
    expect(result.data!.name).toBe("New Name");
  });

  it("captures error on failure", async () => {
    const dbError = new Error("update failed");
    mockTable("database_properties", { data: null, error: dbError });

    const result = await updateProperty("prop-1", { name: "X" });

    expect(result.error).toBe(dbError);
    expect(captureSupabaseErrorMock).toHaveBeenCalledWith(
      dbError,
      "database.updateProperty",
    );
  });
});

// ---------------------------------------------------------------------------
// deleteProperty
// ---------------------------------------------------------------------------

describe("deleteProperty", () => {
  it("deletes a property", async () => {
    mockTable("database_properties", { data: null, error: null });

    const result = await deleteProperty("prop-1");

    expect(result.error).toBeNull();
    expect(tableMocks["database_properties"].calls["delete"]).toBeDefined();
  });

  it("captures error on failure", async () => {
    const dbError = new Error("delete failed");
    mockTable("database_properties", { data: null, error: dbError });

    const result = await deleteProperty("prop-1");

    expect(result.error).toBe(dbError);
    expect(captureSupabaseErrorMock).toHaveBeenCalledWith(
      dbError,
      "database.deleteProperty",
    );
  });
});

// ---------------------------------------------------------------------------
// reorderProperties
// ---------------------------------------------------------------------------

describe("reorderProperties", () => {
  it("updates position for each property in order", async () => {
    mockTable("database_properties", { data: null, error: null });

    const result = await reorderProperties("page-1", [
      "prop-b",
      "prop-a",
      "prop-c",
    ]);

    expect(result.error).toBeNull();
    expect(tableMocks["database_properties"].calls["update"]).toHaveLength(3);
  });

  it("stops and returns error on first failure", async () => {
    const dbError = new Error("update failed");
    mockTable("database_properties", { data: null, error: dbError });

    const result = await reorderProperties("page-1", ["prop-a", "prop-b"]);

    expect(result.error).toBe(dbError);
    expect(captureSupabaseErrorMock).toHaveBeenCalledWith(
      dbError,
      "database.reorderProperties",
    );
  });
});

// ---------------------------------------------------------------------------
// addRow
// ---------------------------------------------------------------------------

describe("addRow", () => {
  it("creates a child page for the database", async () => {
    mockTable("pages", {
      data: {
        ...FAKE_PAGE,
        id: "row-1",
        is_database: false,
        parent_id: "page-1",
        workspace_id: "ws-1",
      },
      error: null,
    });

    const result = await addRow("page-1", "user-1");

    expect(result.error).toBeNull();
    expect(result.data).not.toBeNull();
    expect(tableMocks["pages"].calls["insert"]).toBeDefined();
  });

  it("inserts initial values when provided", async () => {
    mockTable("pages", {
      data: {
        ...FAKE_PAGE,
        id: "row-1",
        is_database: false,
        workspace_id: "ws-1",
      },
      error: null,
    });
    mockTable("row_values", { data: null, error: null });

    const result = await addRow("page-1", "user-1", {
      "prop-1": { text: "Hello" },
    });

    expect(result.error).toBeNull();
    expect(tableMocks["row_values"].calls["insert"]).toBeDefined();
  });

  it("captures error when page lookup fails", async () => {
    const dbError = new Error("not found");
    mockTable("pages", { data: null, error: dbError });

    const result = await addRow("page-1", "user-1");

    expect(result.error).toBe(dbError);
    expect(captureSupabaseErrorMock).toHaveBeenCalledWith(
      dbError,
      "database.addRow:lookup",
    );
  });

  it("ignores non-plain-object initialValues (e.g. MouseEvent leaked from onClick)", async () => {
    mockTable("pages", {
      data: {
        ...FAKE_PAGE,
        id: "row-1",
        is_database: false,
        parent_id: "page-1",
        workspace_id: "ws-1",
      },
      error: null,
    });

    // Simulate a MouseEvent being passed as initialValues — this happens when
    // onClick={onAddRow} forwards the event as the first argument.
    const fakeEvent = Object.create(MouseEvent.prototype, {
      target: { value: {}, enumerable: true },
      type: { value: "click", enumerable: true },
    });

    const result = await addRow(
      "page-1",
      "user-1",
      fakeEvent as unknown as Record<string, Record<string, unknown>>,
    );

    expect(result.error).toBeNull();
    expect(result.data).not.toBeNull();
    // row_values insert should NOT have been called
    expect(tableMocks["row_values"]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// updateRowValue
// ---------------------------------------------------------------------------

describe("updateRowValue", () => {
  it("upserts a row value", async () => {
    const fakeValue = {
      id: "val-1",
      row_id: "row-1",
      property_id: "prop-1",
      value: { text: "Hello" },
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    mockTable("row_values", { data: fakeValue, error: null });

    const result = await updateRowValue("row-1", "prop-1", { text: "Hello" });

    expect(result.error).toBeNull();
    expect(result.data!.value).toEqual({ text: "Hello" });
    expect(tableMocks["row_values"].calls["upsert"]).toBeDefined();
  });

  it("returns error without reporting to Sentry (callers decide)", async () => {
    const dbError = new Error("upsert failed");
    mockTable("row_values", { data: null, error: dbError });

    const result = await updateRowValue("row-1", "prop-1", { text: "X" });

    expect(result.error).toBe(dbError);
    expect(captureSupabaseErrorMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// addView
// ---------------------------------------------------------------------------

describe("addView", () => {
  it("inserts a view with auto-calculated position", async () => {
    mockTable("database_views", {
      data: { ...FAKE_VIEW, id: "view-new", name: "Board", type: "board" },
      error: null,
    });

    const result = await addView("page-1", "Board", "board");

    expect(result.error).toBeNull();
    expect(result.data!.type).toBe("board");
    expect(tableMocks["database_views"].calls["insert"]).toBeDefined();
  });

  it("captures error on failure", async () => {
    const dbError = new Error("insert failed");
    mockTable("database_views", { data: null, error: dbError });

    const result = await addView("page-1", "Board", "board");

    expect(result.error).toBe(dbError);
    expect(captureSupabaseErrorMock).toHaveBeenCalledWith(
      dbError,
      "database.addView",
    );
  });
});

// ---------------------------------------------------------------------------
// updateView
// ---------------------------------------------------------------------------

describe("updateView", () => {
  it("updates view name", async () => {
    const updated = { ...FAKE_VIEW, name: "My Table" };
    mockTable("database_views", { data: updated, error: null });

    const result = await updateView("view-1", { name: "My Table" });

    expect(result.error).toBeNull();
    expect(result.data!.name).toBe("My Table");
  });

  it("captures error on failure", async () => {
    const dbError = new Error("update failed");
    mockTable("database_views", { data: null, error: dbError });

    const result = await updateView("view-1", { name: "X" });

    expect(result.error).toBe(dbError);
    expect(captureSupabaseErrorMock).toHaveBeenCalledWith(
      dbError,
      "database.updateView",
    );
  });
});

// ---------------------------------------------------------------------------
// deleteView
// ---------------------------------------------------------------------------

describe("deleteView", () => {
  it("rejects deleting the last view", async () => {
    mockTable("database_views", {
      data: { database_id: "page-1" },
      error: null,
      count: 1,
    });

    const result = await deleteView("view-1");

    expect(result.error).not.toBeNull();
    expect(result.error!.message).toBe(
      "Cannot delete the last view of a database",
    );
  });

  it("deletes a view when more than one exists", async () => {
    mockTable("database_views", {
      data: { database_id: "page-1" },
      error: null,
      count: 2,
    });

    const result = await deleteView("view-1");

    expect(result.error).toBeNull();
    expect(tableMocks["database_views"].calls["delete"]).toBeDefined();
  });

  it("captures error when lookup fails", async () => {
    const dbError = new Error("not found");
    mockTable("database_views", { data: null, error: dbError });

    const result = await deleteView("view-1");

    expect(result.error).toBe(dbError);
    expect(captureSupabaseErrorMock).toHaveBeenCalledWith(
      dbError,
      "database.deleteView:lookup",
    );
  });
});

// ---------------------------------------------------------------------------
// reorderViews
// ---------------------------------------------------------------------------

describe("reorderViews", () => {
  it("updates position for each view in order", async () => {
    mockTable("database_views", { data: null, error: null });

    const result = await reorderViews("page-1", ["view-b", "view-a"]);

    expect(result.error).toBeNull();
    expect(tableMocks["database_views"].calls["update"]).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// loadDatabase
// ---------------------------------------------------------------------------

describe("loadDatabase", () => {
  it("loads properties, views, and rows with values in parallel", async () => {
    const props = [FAKE_PROPERTY];
    const views = [FAKE_VIEW];
    const rowPages = [
      {
        id: "row-1",
        title: "Row 1",
        icon: null,
        cover_url: null,
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
        created_by: "user-1",
      },
    ];
    const fakeValues = [
      {
        id: "val-1",
        row_id: "row-1",
        property_id: "prop-1",
        value: { text: "Hello" },
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      },
    ];

    mockTable("database_properties", { data: props, error: null });
    mockTable("database_views", { data: views, error: null });
    mockTable("pages", { data: rowPages, error: null });
    mockTable("row_values", { data: fakeValues, error: null });

    const result = await loadDatabase("page-1");

    expect(result.error).toBeNull();
    expect(result.data).not.toBeNull();
    expect(result.data!.properties).toHaveLength(1);
    expect(result.data!.views).toHaveLength(1);
    expect(result.data!.rows).toHaveLength(1);
    expect(result.data!.rows[0].values["prop-1"].value).toEqual({
      text: "Hello",
    });
  });

  it("returns empty rows array when database has no rows", async () => {
    mockTable("database_properties", {
      data: [FAKE_PROPERTY],
      error: null,
    });
    mockTable("database_views", { data: [FAKE_VIEW], error: null });
    mockTable("pages", { data: [], error: null });
    mockTable("row_values", { data: [], error: null });

    const result = await loadDatabase("page-1");

    expect(result.error).toBeNull();
    expect(result.data!.rows).toHaveLength(0);
  });

  it("returns error when properties query fails", async () => {
    const dbError = new Error("properties failed");
    mockTable("database_properties", { data: null, error: dbError });
    mockTable("database_views", { data: [], error: null });
    mockTable("pages", { data: [], error: null });

    const result = await loadDatabase("page-1");

    expect(result.error).toBe(dbError);
    expect(captureSupabaseErrorMock).toHaveBeenCalledWith(
      dbError,
      "database.load:properties",
    );
  });

  it("returns error when views query fails", async () => {
    const dbError = new Error("views failed");
    mockTable("database_properties", {
      data: [FAKE_PROPERTY],
      error: null,
    });
    mockTable("database_views", { data: null, error: dbError });
    mockTable("pages", { data: [], error: null });

    const result = await loadDatabase("page-1");

    expect(result.error).toBe(dbError);
    expect(captureSupabaseErrorMock).toHaveBeenCalledWith(
      dbError,
      "database.load:views",
    );
  });

  it("returns error when rows query fails", async () => {
    const dbError = new Error("rows failed");
    mockTable("database_properties", {
      data: [FAKE_PROPERTY],
      error: null,
    });
    mockTable("database_views", { data: [FAKE_VIEW], error: null });
    mockTable("pages", { data: null, error: dbError });

    const result = await loadDatabase("page-1");

    expect(result.error).toBe(dbError);
    expect(captureSupabaseErrorMock).toHaveBeenCalledWith(
      dbError,
      "database.load:rows",
    );
  });
});

// ---------------------------------------------------------------------------
// loadRow
// ---------------------------------------------------------------------------

describe("loadRow", () => {
  it("loads a row page with its values keyed by property_id", async () => {
    const rowPage = {
      id: "row-1",
      title: "Row 1",
      icon: null,
      cover_url: null,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
      created_by: "user-1",
    };
    const fakeValues = [
      {
        id: "val-1",
        row_id: "row-1",
        property_id: "prop-1",
        value: { text: "A" },
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      },
      {
        id: "val-2",
        row_id: "row-1",
        property_id: "prop-2",
        value: { number: 42 },
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      },
    ];

    mockTable("pages", { data: rowPage, error: null });
    mockTable("row_values", { data: fakeValues, error: null });

    const result = await loadRow("row-1");

    expect(result.error).toBeNull();
    expect(result.data).not.toBeNull();
    expect(result.data!.page.id).toBe("row-1");
    expect(result.data!.values["prop-1"].value).toEqual({ text: "A" });
    expect(result.data!.values["prop-2"].value).toEqual({ number: 42 });
  });

  it("returns error when page lookup fails", async () => {
    const dbError = new Error("not found");
    mockTable("pages", { data: null, error: dbError });
    mockTable("row_values", { data: [], error: null });

    const result = await loadRow("row-1");

    expect(result.error).toBe(dbError);
    expect(captureSupabaseErrorMock).toHaveBeenCalledWith(
      dbError,
      "database.loadRow:page",
    );
  });

  it("returns error when values query fails", async () => {
    const dbError = new Error("values failed");
    mockTable("pages", {
      data: {
        id: "row-1",
        title: "",
        icon: null,
        cover_url: null,
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
        created_by: "user-1",
      },
      error: null,
    });
    mockTable("row_values", { data: null, error: dbError });

    const result = await loadRow("row-1");

    expect(result.error).toBe(dbError);
    expect(captureSupabaseErrorMock).toHaveBeenCalledWith(
      dbError,
      "database.loadRow:values",
    );
  });
});
