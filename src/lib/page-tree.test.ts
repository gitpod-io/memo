import { describe, it, expect } from "vitest";
import type { Page } from "@/lib/types";
import {
  buildTree,
  getDescendantIds,
  findNode,
  getNextSiblingPosition,
  getSortedSiblings,
  computeSwapPositions,
  computeNest,
  computeUnnest,
  computeDrop,
} from "./page-tree";

/** Helper to create a minimal Page for testing. */
function makePage(overrides: Partial<Page> & { id: string }): Page {
  return {
    workspace_id: "ws-1",
    parent_id: null,
    title: overrides.id,
    content: null,
    icon: null,
    cover_url: null,
    position: 0,
    created_by: "user-1",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

describe("buildTree", () => {
  it("builds a flat list into root nodes sorted by position", () => {
    const pages = [
      makePage({ id: "b", position: 1 }),
      makePage({ id: "a", position: 0 }),
      makePage({ id: "c", position: 2 }),
    ];

    const tree = buildTree(pages);

    expect(tree).toHaveLength(3);
    expect(tree.map((n) => n.page.id)).toEqual(["a", "b", "c"]);
  });

  it("nests children under their parent", () => {
    const pages = [
      makePage({ id: "root", position: 0 }),
      makePage({ id: "child-1", parent_id: "root", position: 0 }),
      makePage({ id: "child-2", parent_id: "root", position: 1 }),
    ];

    const tree = buildTree(pages);

    expect(tree).toHaveLength(1);
    expect(tree[0].page.id).toBe("root");
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children[0].page.id).toBe("child-1");
    expect(tree[0].children[1].page.id).toBe("child-2");
  });

  it("treats orphans (parent_id references missing page) as roots", () => {
    const pages = [
      makePage({ id: "a", position: 0 }),
      makePage({ id: "orphan", parent_id: "nonexistent", position: 1 }),
    ];

    const tree = buildTree(pages);

    expect(tree).toHaveLength(2);
    expect(tree.map((n) => n.page.id)).toEqual(["a", "orphan"]);
  });

  it("sorts children by position at every level", () => {
    const pages = [
      makePage({ id: "root", position: 0 }),
      makePage({ id: "c2", parent_id: "root", position: 2 }),
      makePage({ id: "c0", parent_id: "root", position: 0 }),
      makePage({ id: "c1", parent_id: "root", position: 1 }),
      makePage({ id: "gc1", parent_id: "c1", position: 1 }),
      makePage({ id: "gc0", parent_id: "c1", position: 0 }),
    ];

    const tree = buildTree(pages);
    const root = tree[0];

    expect(root.children.map((n) => n.page.id)).toEqual(["c0", "c1", "c2"]);
    expect(root.children[1].children.map((n) => n.page.id)).toEqual([
      "gc0",
      "gc1",
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(buildTree([])).toEqual([]);
  });
});

describe("getDescendantIds", () => {
  it("returns all descendant IDs recursively", () => {
    const pages = [
      makePage({ id: "root", position: 0 }),
      makePage({ id: "child", parent_id: "root", position: 0 }),
      makePage({ id: "grandchild", parent_id: "child", position: 0 }),
    ];

    const tree = buildTree(pages);
    const ids = getDescendantIds(tree[0]);

    expect(ids).toEqual(["child", "grandchild"]);
  });

  it("returns empty array for leaf nodes", () => {
    const pages = [makePage({ id: "leaf", position: 0 })];
    const tree = buildTree(pages);

    expect(getDescendantIds(tree[0])).toEqual([]);
  });
});

describe("findNode", () => {
  it("finds a root node", () => {
    const pages = [
      makePage({ id: "a", position: 0 }),
      makePage({ id: "b", position: 1 }),
    ];
    const tree = buildTree(pages);

    expect(findNode(tree, "b")?.page.id).toBe("b");
  });

  it("finds a deeply nested node", () => {
    const pages = [
      makePage({ id: "root", position: 0 }),
      makePage({ id: "child", parent_id: "root", position: 0 }),
      makePage({ id: "deep", parent_id: "child", position: 0 }),
    ];
    const tree = buildTree(pages);

    expect(findNode(tree, "deep")?.page.id).toBe("deep");
  });

  it("returns null for non-existent ID", () => {
    const tree = buildTree([makePage({ id: "a", position: 0 })]);

    expect(findNode(tree, "missing")).toBeNull();
  });
});

describe("getNextSiblingPosition", () => {
  it("returns 0 when there are no siblings", () => {
    expect(getNextSiblingPosition([], null)).toBe(0);
  });

  it("returns max position + 1 among siblings", () => {
    const pages = [
      makePage({ id: "a", position: 0 }),
      makePage({ id: "b", position: 3 }),
      makePage({ id: "c", position: 1 }),
    ];

    expect(getNextSiblingPosition(pages, null)).toBe(4);
  });

  it("scopes to the correct parent", () => {
    const pages = [
      makePage({ id: "root", position: 5 }),
      makePage({ id: "child", parent_id: "root", position: 2 }),
    ];

    expect(getNextSiblingPosition(pages, "root")).toBe(3);
    expect(getNextSiblingPosition(pages, null)).toBe(6);
  });
});

describe("getSortedSiblings", () => {
  it("returns siblings sorted by position", () => {
    const pages = [
      makePage({ id: "c", position: 2 }),
      makePage({ id: "a", position: 0 }),
      makePage({ id: "b", position: 1 }),
      makePage({ id: "child", parent_id: "a", position: 0 }),
    ];

    const siblings = getSortedSiblings(pages, null);

    expect(siblings.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });
});

describe("computeSwapPositions", () => {
  const pages = [
    makePage({ id: "a", position: 0 }),
    makePage({ id: "b", position: 1 }),
    makePage({ id: "c", position: 2 }),
  ];

  it("swaps with the previous sibling when moving up", () => {
    const result = computeSwapPositions(pages, "b", "up");

    expect(result).toEqual({
      updates: [
        { id: "b", position: 0 },
        { id: "a", position: 1 },
      ],
    });
  });

  it("swaps with the next sibling when moving down", () => {
    const result = computeSwapPositions(pages, "b", "down");

    expect(result).toEqual({
      updates: [
        { id: "b", position: 2 },
        { id: "c", position: 1 },
      ],
    });
  });

  it("returns null when moving up the first sibling", () => {
    expect(computeSwapPositions(pages, "a", "up")).toBeNull();
  });

  it("returns null when moving down the last sibling", () => {
    expect(computeSwapPositions(pages, "c", "down")).toBeNull();
  });

  it("returns null for non-existent page", () => {
    expect(computeSwapPositions(pages, "missing", "up")).toBeNull();
  });
});

describe("computeNest", () => {
  it("nests a page under its preceding sibling", () => {
    const pages = [
      makePage({ id: "a", position: 0 }),
      makePage({ id: "b", position: 1 }),
    ];

    const result = computeNest(pages, "b");

    expect(result).toEqual({ parentId: "a", position: 0 });
  });

  it("places nested page after existing children of new parent", () => {
    const pages = [
      makePage({ id: "a", position: 0 }),
      makePage({ id: "b", position: 1 }),
      makePage({ id: "a-child", parent_id: "a", position: 0 }),
    ];

    const result = computeNest(pages, "b");

    expect(result).toEqual({ parentId: "a", position: 1 });
  });

  it("returns null for the first sibling (nothing above to nest under)", () => {
    const pages = [
      makePage({ id: "a", position: 0 }),
      makePage({ id: "b", position: 1 }),
    ];

    expect(computeNest(pages, "a")).toBeNull();
  });

  it("returns null for non-existent page", () => {
    expect(computeNest([], "missing")).toBeNull();
  });
});

describe("computeUnnest", () => {
  it("moves a child to its parent's level, right after the parent", () => {
    const pages = [
      makePage({ id: "parent", position: 0 }),
      makePage({ id: "child", parent_id: "parent", position: 0 }),
      makePage({ id: "sibling", position: 1 }),
    ];

    const result = computeUnnest(pages, "child");

    expect(result).toEqual({
      pageUpdate: { parentId: null, position: 1 },
      shiftUpdates: [{ id: "sibling", position: 2 }],
    });
  });

  it("returns null for a root page", () => {
    const pages = [makePage({ id: "root", position: 0 })];

    expect(computeUnnest(pages, "root")).toBeNull();
  });

  it("returns null for non-existent page", () => {
    expect(computeUnnest([], "missing")).toBeNull();
  });

  it("shifts multiple siblings when unnesting", () => {
    const pages = [
      makePage({ id: "parent", position: 0 }),
      makePage({ id: "child", parent_id: "parent", position: 0 }),
      makePage({ id: "sib1", position: 1 }),
      makePage({ id: "sib2", position: 2 }),
    ];

    const result = computeUnnest(pages, "child");

    expect(result).toEqual({
      pageUpdate: { parentId: null, position: 1 },
      shiftUpdates: [
        { id: "sib1", position: 2 },
        { id: "sib2", position: 3 },
      ],
    });
  });

  it("handles deeply nested unnest (child moves to grandparent level)", () => {
    const pages = [
      makePage({ id: "grandparent", position: 0 }),
      makePage({ id: "parent", parent_id: "grandparent", position: 0 }),
      makePage({ id: "child", parent_id: "parent", position: 0 }),
    ];

    const result = computeUnnest(pages, "child");

    expect(result).toEqual({
      pageUpdate: { parentId: "grandparent", position: 1 },
      shiftUpdates: [],
    });
  });
});

describe("computeDrop", () => {
  it("returns null when dragging onto self", () => {
    const pages = [makePage({ id: "a", position: 0 })];
    const tree = buildTree(pages);

    expect(computeDrop(pages, tree, "a", "a", "inside")).toBeNull();
  });

  it("returns null when dropping parent onto its descendant", () => {
    const pages = [
      makePage({ id: "parent", position: 0 }),
      makePage({ id: "child", parent_id: "parent", position: 0 }),
    ];
    const tree = buildTree(pages);

    expect(computeDrop(pages, tree, "parent", "child", "inside")).toBeNull();
  });

  it("drops inside a target (makes it a child)", () => {
    const pages = [
      makePage({ id: "a", position: 0 }),
      makePage({ id: "b", position: 1 }),
    ];
    const tree = buildTree(pages);

    const result = computeDrop(pages, tree, "b", "a", "inside");

    expect(result).toEqual({
      updates: [{ id: "b", parentId: "a", position: 0 }],
    });
  });

  it("drops before a target (reorders siblings)", () => {
    const pages = [
      makePage({ id: "a", position: 0 }),
      makePage({ id: "b", position: 1 }),
      makePage({ id: "c", position: 2 }),
    ];
    const tree = buildTree(pages);

    const result = computeDrop(pages, tree, "c", "a", "before");

    expect(result).toEqual({
      updates: [
        { id: "c", parentId: null, position: 0 },
        { id: "a", parentId: null, position: 1 },
        { id: "b", parentId: null, position: 2 },
      ],
    });
  });

  it("drops after a target (reorders siblings)", () => {
    const pages = [
      makePage({ id: "a", position: 0 }),
      makePage({ id: "b", position: 1 }),
      makePage({ id: "c", position: 2 }),
    ];
    const tree = buildTree(pages);

    const result = computeDrop(pages, tree, "c", "a", "after");

    expect(result).toEqual({
      updates: [
        { id: "a", parentId: null, position: 0 },
        { id: "c", parentId: null, position: 1 },
        { id: "b", parentId: null, position: 2 },
      ],
    });
  });

  it("drops across parents (moves to a different parent level)", () => {
    const pages = [
      makePage({ id: "root1", position: 0 }),
      makePage({ id: "child", parent_id: "root1", position: 0 }),
      makePage({ id: "root2", position: 1 }),
    ];
    const tree = buildTree(pages);

    const result = computeDrop(pages, tree, "child", "root2", "after");

    expect(result).toEqual({
      updates: [
        { id: "root1", parentId: null, position: 0 },
        { id: "root2", parentId: null, position: 1 },
        { id: "child", parentId: null, position: 2 },
      ],
    });
  });

  it("returns null for non-existent pages", () => {
    const tree = buildTree([]);

    expect(computeDrop([], tree, "a", "b", "inside")).toBeNull();
  });
});
