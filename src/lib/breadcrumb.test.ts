import { describe, it, expect } from "vitest";
import { buildBreadcrumbMap, getParentBreadcrumb } from "./breadcrumb";
import type { SidebarPage } from "@/lib/types";

function makePage(overrides: Partial<SidebarPage> & { id: string }): SidebarPage {
  return {
    workspace_id: "ws-1",
    parent_id: null,
    title: "",
    icon: null,
    cover_url: null,
    is_database: false,
    position: 0,
    created_by: "user-1",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

describe("buildBreadcrumbMap", () => {
  it("returns page title for root-level pages", () => {
    const pages = [makePage({ id: "a", title: "Root Page" })];
    const map = buildBreadcrumbMap(pages);
    expect(map.get("a")).toBe("Root Page");
  });

  it("uses 'Untitled' for pages with empty title", () => {
    const pages = [makePage({ id: "a", title: "" })];
    const map = buildBreadcrumbMap(pages);
    expect(map.get("a")).toBe("Untitled");
  });

  it("builds parent → child path for nested pages", () => {
    const pages = [
      makePage({ id: "a", title: "Parent" }),
      makePage({ id: "b", title: "Child", parent_id: "a" }),
    ];
    const map = buildBreadcrumbMap(pages);
    expect(map.get("b")).toBe("Parent → Child");
  });

  it("builds multi-level breadcrumb paths", () => {
    const pages = [
      makePage({ id: "a", title: "Grandparent" }),
      makePage({ id: "b", title: "Parent", parent_id: "a" }),
      makePage({ id: "c", title: "Child", parent_id: "b" }),
    ];
    const map = buildBreadcrumbMap(pages);
    expect(map.get("c")).toBe("Grandparent → Parent → Child");
  });

  it("handles pages whose parent_id references a missing page", () => {
    const pages = [
      makePage({ id: "a", title: "Orphan", parent_id: "missing" }),
    ];
    const map = buildBreadcrumbMap(pages);
    expect(map.get("a")).toBe("Orphan");
  });
});

describe("getParentBreadcrumb", () => {
  it("returns null for root-level pages", () => {
    const pages = [makePage({ id: "a", title: "Root" })];
    const map = buildBreadcrumbMap(pages);
    expect(getParentBreadcrumb("a", map)).toBeNull();
  });

  it("returns parent path for nested pages", () => {
    const pages = [
      makePage({ id: "a", title: "Parent" }),
      makePage({ id: "b", title: "Child", parent_id: "a" }),
    ];
    const map = buildBreadcrumbMap(pages);
    expect(getParentBreadcrumb("b", map)).toBe("Parent");
  });

  it("returns full ancestor chain for deeply nested pages", () => {
    const pages = [
      makePage({ id: "a", title: "L1" }),
      makePage({ id: "b", title: "L2", parent_id: "a" }),
      makePage({ id: "c", title: "L3", parent_id: "b" }),
    ];
    const map = buildBreadcrumbMap(pages);
    expect(getParentBreadcrumb("c", map)).toBe("L1 → L2");
  });

  it("returns null for unknown page IDs", () => {
    const map = buildBreadcrumbMap([]);
    expect(getParentBreadcrumb("unknown", map)).toBeNull();
  });
});
