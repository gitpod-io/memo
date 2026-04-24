// Pure functions for page tree manipulation.
// No React or Supabase dependencies — all computation is side-effect-free.

import type { SidebarPage } from "@/lib/types";

export interface TreeNode {
  page: SidebarPage;
  children: TreeNode[];
}

/** Build a nested tree from a flat list of pages. Orphans become roots.
 *  Database row pages (children of `is_database` pages) are excluded from the
 *  tree so they don't clutter the sidebar — they're accessed via the database view. */
export function buildTree(pages: SidebarPage[]): TreeNode[] {
  // Collect IDs of database pages so we can filter out their children (rows).
  const databaseIds = new Set(
    pages.filter((p) => p.is_database).map((p) => p.id),
  );

  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const page of pages) {
    // Skip database rows — pages whose parent is a database
    if (page.parent_id && databaseIds.has(page.parent_id)) continue;
    map.set(page.id, { page, children: [] });
  }

  for (const [, node] of map) {
    const { page } = node;
    if (page.parent_id && map.has(page.parent_id)) {
      map.get(page.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  function sortChildren(nodes: TreeNode[]) {
    nodes.sort((a, b) => a.page.position - b.page.position);
    for (const node of nodes) {
      sortChildren(node.children);
    }
  }
  sortChildren(roots);

  return roots;
}

/** Collect all descendant IDs of a tree node (not including the node itself). */
export function getDescendantIds(node: TreeNode): string[] {
  const ids: string[] = [];
  for (const child of node.children) {
    ids.push(child.page.id);
    ids.push(...getDescendantIds(child));
  }
  return ids;
}

/** Find a node by ID anywhere in the tree. Returns null if not found. */
export function findNode(nodes: TreeNode[], id: string): TreeNode | null {
  for (const node of nodes) {
    if (node.page.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return null;
}

/** Get the next available position among siblings of a given parent. */
export function getNextSiblingPosition(
  pages: SidebarPage[],
  parentId: string | null,
): number {
  const siblings = pages.filter((p) => p.parent_id === parentId);
  return siblings.length > 0
    ? Math.max(...siblings.map((p) => p.position)) + 1
    : 0;
}

/** Get sorted siblings for a page (pages sharing the same parent_id). */
export function getSortedSiblings(pages: SidebarPage[], parentId: string | null): SidebarPage[] {
  return pages
    .filter((p) => p.parent_id === parentId)
    .sort((a, b) => a.position - b.position);
}

/**
 * Compute position swaps for moving a page up or down among siblings.
 * Returns null if the move is not possible, otherwise returns the two
 * page updates needed (swap positions of the two adjacent pages).
 */
export function computeSwapPositions(
  pages: SidebarPage[],
  pageId: string,
  direction: "up" | "down",
): { updates: Array<{ id: string; position: number }> } | null {
  const page = pages.find((p) => p.id === pageId);
  if (!page) return null;

  const siblings = getSortedSiblings(pages, page.parent_id);
  const idx = siblings.findIndex((p) => p.id === pageId);

  if (direction === "up") {
    if (idx <= 0) return null;
    const other = siblings[idx - 1];
    return {
      updates: [
        { id: page.id, position: other.position },
        { id: other.id, position: page.position },
      ],
    };
  } else {
    if (idx < 0 || idx >= siblings.length - 1) return null;
    const other = siblings[idx + 1];
    return {
      updates: [
        { id: page.id, position: other.position },
        { id: other.id, position: page.position },
      ],
    };
  }
}

/**
 * Compute the update needed to nest a page under its preceding sibling.
 * Returns null if nesting is not possible (page is first among siblings).
 */
export function computeNest(
  pages: SidebarPage[],
  pageId: string,
): { parentId: string; position: number } | null {
  const page = pages.find((p) => p.id === pageId);
  if (!page) return null;

  const siblings = getSortedSiblings(pages, page.parent_id);
  const idx = siblings.findIndex((p) => p.id === pageId);
  if (idx <= 0) return null;

  const newParent = siblings[idx - 1];
  const position = getNextSiblingPosition(pages, newParent.id);

  return { parentId: newParent.id, position };
}

/**
 * Compute the updates needed to unnest a page (move it to its parent's level).
 * Returns null if the page has no parent. The page is placed right after its
 * former parent, and existing siblings at that level are shifted down.
 */
export function computeUnnest(
  pages: SidebarPage[],
  pageId: string,
): {
  pageUpdate: { parentId: string | null; position: number };
  shiftUpdates: Array<{ id: string; position: number }>;
} | null {
  const page = pages.find((p) => p.id === pageId);
  if (!page || !page.parent_id) return null;

  const parent = pages.find((p) => p.id === page.parent_id);
  if (!parent) return null;

  const parentSiblings = getSortedSiblings(pages, parent.parent_id);
  const nextPosition = parent.position + 1;

  const toShift = parentSiblings.filter(
    (p) => p.position >= nextPosition && p.id !== pageId,
  );

  return {
    pageUpdate: { parentId: parent.parent_id, position: nextPosition },
    shiftUpdates: toShift.map((s) => ({
      id: s.id,
      position: s.position + 1,
    })),
  };
}

export type DropPosition = "before" | "after" | "inside";

/**
 * Compute the updates needed after a drag-and-drop operation.
 * Returns null if the drop is invalid (same page, or dropping onto a descendant).
 */
export function computeDrop(
  pages: SidebarPage[],
  tree: TreeNode[],
  draggedId: string,
  targetId: string,
  position: DropPosition,
): { updates: Array<{ id: string; parentId: string | null; position: number }> } | null {
  if (draggedId === targetId) return null;

  const draggedPage = pages.find((p) => p.id === draggedId);
  const targetPage = pages.find((p) => p.id === targetId);
  if (!draggedPage || !targetPage) return null;

  // Prevent dropping a parent onto its own descendant
  const draggedNode = findNode(tree, draggedId);
  if (draggedNode) {
    const descendantIds = getDescendantIds(draggedNode);
    if (descendantIds.includes(targetId)) return null;
  }

  if (position === "inside") {
    const nextPos = getNextSiblingPosition(pages, targetPage.id);
    return {
      updates: [
        { id: draggedId, parentId: targetPage.id, position: nextPos },
      ],
    };
  }

  // "before" or "after" — reorder among target's siblings
  const newParentId = targetPage.parent_id;
  const siblings = pages
    .filter((p) => p.parent_id === newParentId && p.id !== draggedId)
    .sort((a, b) => a.position - b.position);

  const targetIdx = siblings.findIndex((p) => p.id === targetPage.id);
  const insertIdx = position === "before" ? targetIdx : targetIdx + 1;

  const reordered = [...siblings];
  reordered.splice(insertIdx, 0, draggedPage);

  return {
    updates: reordered.map((p, i) => ({
      id: p.id,
      parentId: newParentId,
      position: i,
    })),
  };
}
