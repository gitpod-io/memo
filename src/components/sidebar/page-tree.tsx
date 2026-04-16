"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronRight,
  FileText,
  GripVertical,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { captureSupabaseError } from "@/lib/sentry";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Page } from "@/lib/types";

interface PageTreeProps {
  userId: string;
}

interface TreeNode {
  page: Page;
  children: TreeNode[];
}

function buildTree(pages: Page[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const page of pages) {
    map.set(page.id, { page, children: [] });
  }

  for (const page of pages) {
    const node = map.get(page.id)!;
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

function getDescendantIds(node: TreeNode): string[] {
  const ids: string[] = [];
  for (const child of node.children) {
    ids.push(child.page.id);
    ids.push(...getDescendantIds(child));
  }
  return ids;
}

function findNode(nodes: TreeNode[], id: string): TreeNode | null {
  for (const node of nodes) {
    if (node.page.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return null;
}

export function PageTree({ userId }: PageTreeProps) {
  const router = useRouter();
  const params = useParams<{ workspaceSlug?: string; pageId?: string }>();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<TreeNode | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    position: "before" | "after" | "inside";
  } | null>(null);

  const workspaceSlug = params.workspaceSlug;

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceSlug) return;

    const supabase = createClient();
    supabase
      .from("workspaces")
      .select("id")
      .eq("slug", workspaceSlug)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          captureSupabaseError(error, "page-tree:workspace-lookup");
          return;
        }
        if (data) setWorkspaceId(data.id);
      });
  }, [workspaceSlug]);

  const fetchPages = useCallback(async () => {
    if (!workspaceId) return;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("pages")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("position", { ascending: true });

    if (error) {
      captureSupabaseError(error, "page-tree:fetch-pages");
      toast.error("Failed to load pages");
    }

    if (data) {
      setPages(data);
    }
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    if (workspaceId) {
      fetchPages();
    }
  }, [workspaceId, fetchPages]);

  const tree = useMemo(() => buildTree(pages), [pages]);

  const toggleExpand = useCallback((pageId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });
  }, []);

  async function handleCreate(parentId: string | null) {
    if (!workspaceId || !workspaceSlug) return;

    const siblings = pages.filter((p) => p.parent_id === parentId);
    const nextPosition =
      siblings.length > 0
        ? Math.max(...siblings.map((p) => p.position)) + 1
        : 0;

    const supabase = createClient();
    const { data: newPage, error } = await supabase
      .from("pages")
      .insert({
        workspace_id: workspaceId,
        parent_id: parentId,
        title: "",
        position: nextPosition,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      captureSupabaseError(error, "page-tree:create-page");
      toast.error("Failed to create page");
      return;
    }
    if (!newPage) return;

    setPages((prev) => [...prev, newPage]);

    if (parentId) {
      setExpanded((prev) => new Set(prev).add(parentId));
    }

    router.push(`/${workspaceSlug}/${newPage.id}`);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("pages")
      .delete()
      .eq("id", deleteTarget.page.id);

    if (error) {
      captureSupabaseError(error, "page-tree:delete-page");
      toast.error("Failed to delete page");
    } else {
      const removedIds = new Set([
        deleteTarget.page.id,
        ...getDescendantIds(deleteTarget),
      ]);
      setPages((prev) => prev.filter((p) => !removedIds.has(p.id)));

      if (params.pageId && removedIds.has(params.pageId)) {
        router.push(`/${workspaceSlug}`);
      }
    }

    setDeleting(false);
    setDeleteTarget(null);
  }

  async function handleMoveUp(page: Page) {
    const siblings = pages
      .filter((p) => p.parent_id === page.parent_id)
      .sort((a, b) => a.position - b.position);

    const idx = siblings.findIndex((p) => p.id === page.id);
    if (idx <= 0) return;

    const prev = siblings[idx - 1];
    await swapPositions(page, prev);
  }

  async function handleMoveDown(page: Page) {
    const siblings = pages
      .filter((p) => p.parent_id === page.parent_id)
      .sort((a, b) => a.position - b.position);

    const idx = siblings.findIndex((p) => p.id === page.id);
    if (idx < 0 || idx >= siblings.length - 1) return;

    const next = siblings[idx + 1];
    await swapPositions(page, next);
  }

  async function swapPositions(a: Page, b: Page) {
    const supabase = createClient();

    setPages((prev) =>
      prev.map((p) => {
        if (p.id === a.id) return { ...p, position: b.position };
        if (p.id === b.id) return { ...p, position: a.position };
        return p;
      })
    );

    const results = await Promise.all([
      supabase.from("pages").update({ position: b.position }).eq("id", a.id),
      supabase.from("pages").update({ position: a.position }).eq("id", b.id),
    ]);

    for (const result of results) {
      if (result.error) {
        captureSupabaseError(result.error, "page-tree:swap-positions");
        toast.error("Failed to reorder page");
        break;
      }
    }
  }

  async function handleNest(page: Page) {
    const siblings = pages
      .filter((p) => p.parent_id === page.parent_id)
      .sort((a, b) => a.position - b.position);

    const idx = siblings.findIndex((p) => p.id === page.id);
    if (idx <= 0) return;

    const newParent = siblings[idx - 1];
    const newSiblings = pages.filter((p) => p.parent_id === newParent.id);
    const nextPosition =
      newSiblings.length > 0
        ? Math.max(...newSiblings.map((p) => p.position)) + 1
        : 0;

    const supabase = createClient();

    setPages((prev) =>
      prev.map((p) =>
        p.id === page.id
          ? { ...p, parent_id: newParent.id, position: nextPosition }
          : p
      )
    );

    setExpanded((prev) => new Set(prev).add(newParent.id));

    const { error } = await supabase
      .from("pages")
      .update({ parent_id: newParent.id, position: nextPosition })
      .eq("id", page.id);

    if (error) {
      captureSupabaseError(error, "page-tree:nest-page");
      toast.error("Failed to nest page");
    }
  }

  async function handleUnnest(page: Page) {
    if (!page.parent_id) return;

    const parent = pages.find((p) => p.id === page.parent_id);
    if (!parent) return;

    const parentSiblings = pages
      .filter((p) => p.parent_id === parent.parent_id)
      .sort((a, b) => a.position - b.position);

    const nextPosition = parent.position + 1;

    const toShift = parentSiblings.filter(
      (p) => p.position >= nextPosition && p.id !== page.id
    );

    const supabase = createClient();

    setPages((prev) =>
      prev.map((p) => {
        if (p.id === page.id) {
          return { ...p, parent_id: parent.parent_id, position: nextPosition };
        }
        if (toShift.some((s) => s.id === p.id)) {
          return { ...p, position: p.position + 1 };
        }
        return p;
      })
    );

    const updates = [
      supabase
        .from("pages")
        .update({ parent_id: parent.parent_id, position: nextPosition })
        .eq("id", page.id),
      ...toShift.map((s) =>
        supabase
          .from("pages")
          .update({ position: s.position + 1 })
          .eq("id", s.id)
      ),
    ];

    const results = await Promise.all(updates);

    for (const result of results) {
      if (result.error) {
        captureSupabaseError(result.error, "page-tree:unnest-page");
        toast.error("Failed to unnest page");
        break;
      }
    }
  }

  function handleDragStart(e: React.DragEvent, pageId: string) {
    setDraggedId(pageId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", pageId);
  }

  function handleDragOver(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (draggedId === targetId) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;

    let position: "before" | "after" | "inside";
    if (y < height * 0.25) {
      position = "before";
    } else if (y > height * 0.75) {
      position = "after";
    } else {
      position = "inside";
    }

    setDropTarget({ id: targetId, position });
  }

  function handleDragLeave() {
    setDropTarget(null);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (!draggedId || !dropTarget || draggedId === dropTarget.id) {
      setDraggedId(null);
      setDropTarget(null);
      return;
    }

    const draggedPage = pages.find((p) => p.id === draggedId);
    const targetPage = pages.find((p) => p.id === dropTarget.id);
    if (!draggedPage || !targetPage) {
      setDraggedId(null);
      setDropTarget(null);
      return;
    }

    // Prevent dropping a parent onto its own descendant
    const draggedNode = findNode(tree, draggedId);
    if (draggedNode) {
      const descendantIds = getDescendantIds(draggedNode);
      if (descendantIds.includes(dropTarget.id)) {
        setDraggedId(null);
        setDropTarget(null);
        return;
      }
    }

    const supabase = createClient();

    if (dropTarget.position === "inside") {
      const newSiblings = pages.filter((p) => p.parent_id === targetPage.id);
      const nextPos =
        newSiblings.length > 0
          ? Math.max(...newSiblings.map((p) => p.position)) + 1
          : 0;

      setPages((prev) =>
        prev.map((p) =>
          p.id === draggedId
            ? { ...p, parent_id: targetPage.id, position: nextPos }
            : p
        )
      );
      setExpanded((prev) => new Set(prev).add(targetPage.id));

      const { error } = await supabase
        .from("pages")
        .update({ parent_id: targetPage.id, position: nextPos })
        .eq("id", draggedId);

      if (error) {
        captureSupabaseError(error, "page-tree:drop-inside");
        toast.error("Failed to move page");
      }
    } else {
      const newParentId = targetPage.parent_id;
      const siblings = pages
        .filter((p) => p.parent_id === newParentId && p.id !== draggedId)
        .sort((a, b) => a.position - b.position);

      const targetIdx = siblings.findIndex((p) => p.id === targetPage.id);
      const insertIdx =
        dropTarget.position === "before" ? targetIdx : targetIdx + 1;

      const reordered = [...siblings];
      reordered.splice(insertIdx, 0, draggedPage);

      setPages((prev) => {
        const next = [...prev];
        for (let i = 0; i < reordered.length; i++) {
          const idx = next.findIndex((p) => p.id === reordered[i].id);
          if (idx !== -1) {
            next[idx] = {
              ...next[idx],
              parent_id: newParentId,
              position: i,
            };
          }
        }
        return next;
      });

      for (let i = 0; i < reordered.length; i++) {
        const { error } = await supabase
          .from("pages")
          .update({ parent_id: newParentId, position: i })
          .eq("id", reordered[i].id);

        if (error) {
          captureSupabaseError(error, "page-tree:drop-reorder");
          toast.error("Failed to move page");
          break;
        }
      }
    }

    setDraggedId(null);
    setDropTarget(null);
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDropTarget(null);
  }

  if (!workspaceSlug) return null;

  return (
    <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
      <p className="px-2 text-xs tracking-widest uppercase text-white/30">
        Pages
      </p>

      {loading ? (
        <div className="flex flex-col gap-1 px-2">
          <div className="h-7 animate-pulse bg-muted" />
          <div className="h-7 animate-pulse bg-muted" />
          <div className="h-7 animate-pulse bg-muted" />
        </div>
      ) : tree.length === 0 ? (
        <div className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          <span>No pages yet</span>
        </div>
      ) : (
        <div
          className="flex flex-col gap-0.5"
          role="tree"
          aria-label="Page tree"
        >
          {tree.map((node) => (
            <PageTreeItem
              key={node.page.id}
              node={node}
              depth={0}
              expanded={expanded}
              toggleExpand={toggleExpand}
              selectedPageId={params.pageId}
              workspaceSlug={workspaceSlug}
              onNavigate={(pageId) =>
                router.push(`/${workspaceSlug}/${pageId}`)
              }
              onCreate={handleCreate}
              onDelete={setDeleteTarget}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onNest={handleNest}
              onUnnest={handleUnnest}
              draggedId={draggedId}
              dropTarget={dropTarget}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              pages={pages}
            />
          ))}
        </div>
      )}

      <Button
        variant="ghost"
        className="mt-1 w-full justify-start gap-2 px-2 text-muted-foreground"
        size="sm"
        onClick={() => handleCreate(null)}
      >
        <Plus className="h-4 w-4" />
        New Page
      </Button>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete page</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && deleteTarget.children.length > 0
                ? `Are you sure you want to delete "${deleteTarget.page.title || "Untitled"}" and its ${deleteTarget.children.length} sub-page${deleteTarget.children.length === 1 ? "" : "s"}? This action cannot be undone.`
                : `Are you sure you want to delete "${deleteTarget?.page.title || "Untitled"}"? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface PageTreeItemProps {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  toggleExpand: (id: string) => void;
  selectedPageId: string | undefined;
  workspaceSlug: string;
  onNavigate: (pageId: string) => void;
  onCreate: (parentId: string | null) => void;
  onDelete: (node: TreeNode) => void;
  onMoveUp: (page: Page) => void;
  onMoveDown: (page: Page) => void;
  onNest: (page: Page) => void;
  onUnnest: (page: Page) => void;
  draggedId: string | null;
  dropTarget: { id: string; position: "before" | "after" | "inside" } | null;
  onDragStart: (e: React.DragEvent, pageId: string) => void;
  onDragOver: (e: React.DragEvent, targetId: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  pages: Page[];
}

function PageTreeItem({
  node,
  depth,
  expanded,
  toggleExpand,
  selectedPageId,
  workspaceSlug,
  onNavigate,
  onCreate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onNest,
  onUnnest,
  draggedId,
  dropTarget,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  pages,
}: PageTreeItemProps) {
  const { page } = node;
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(page.id);
  const isSelected = selectedPageId === page.id;
  const isDragged = draggedId === page.id;
  const isDropTarget = dropTarget?.id === page.id;

  const siblings = pages
    .filter((p) => p.parent_id === page.parent_id)
    .sort((a, b) => a.position - b.position);
  const siblingIdx = siblings.findIndex((p) => p.id === page.id);
  const canNest = siblingIdx > 0;
  const canUnnest = page.parent_id !== null;
  const canMoveUp = siblingIdx > 0;
  const canMoveDown = siblingIdx < siblings.length - 1;

  return (
    <div role="treeitem" aria-selected={isSelected} aria-expanded={hasChildren ? isExpanded : undefined}>
      <div
        className={`group relative flex items-center gap-0.5 py-0.5 pr-1 text-sm ${
          isSelected
            ? "bg-white/[0.08] font-medium text-white/70"
            : "text-muted-foreground hover:bg-white/[0.04]"
        } ${isDragged ? "opacity-50" : ""}`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        draggable
        onDragStart={(e) => onDragStart(e, page.id)}
        onDragOver={(e) => onDragOver(e, page.id)}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
      >
        {isDropTarget && dropTarget?.position === "before" && (
          <div className="absolute top-0 right-0 left-0 h-0.5 bg-accent" />
        )}
        {isDropTarget && dropTarget?.position === "after" && (
          <div className="absolute right-0 bottom-0 left-0 h-0.5 bg-accent" />
        )}
        {isDropTarget && dropTarget?.position === "inside" && (
          <div className="absolute inset-0 border border-accent bg-accent/10" />
        )}

        <span className="flex shrink-0 cursor-grab items-center text-muted-foreground opacity-0 group-hover:opacity-100">
          <GripVertical className="h-3 w-3" />
        </span>

        <button
          className="flex h-4 w-4 shrink-0 items-center justify-center"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) {
              toggleExpand(page.id);
            }
          }}
          tabIndex={-1}
          aria-label={isExpanded ? "Collapse" : "Expand"}
        >
          {hasChildren && (
            <ChevronRight
              className={`h-3 w-3 transition-transform duration-150 ${
                isExpanded ? "rotate-90" : ""
              }`}
            />
          )}
        </button>

        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          {page.icon ? (
            <span className="text-sm">{page.icon}</span>
          ) : (
            <FileText className="h-4 w-4" />
          )}
        </span>

        <button
          className="flex-1 truncate text-left"
          onClick={() => onNavigate(page.id)}
        >
          {page.title || "Untitled"}
        </button>

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon-xs"
            className="h-5 w-5"
            onClick={(e) => {
              e.stopPropagation();
              onCreate(page.id);
            }}
            aria-label="Add sub-page"
          >
            <Plus className="h-3 w-3" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="h-5 w-5"
                  aria-label="Page actions"
                />
              }
            >
              <MoreHorizontal className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" sideOffset={4}>
              <DropdownMenuItem onClick={() => onCreate(page.id)}>
                <Plus className="h-4 w-4" />
                Add sub-page
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {canMoveUp && (
                <DropdownMenuItem onClick={() => onMoveUp(page)}>
                  Move up
                </DropdownMenuItem>
              )}
              {canMoveDown && (
                <DropdownMenuItem onClick={() => onMoveDown(page)}>
                  Move down
                </DropdownMenuItem>
              )}
              {canNest && (
                <DropdownMenuItem onClick={() => onNest(page)}>
                  Nest under above
                </DropdownMenuItem>
              )}
              {canUnnest && (
                <DropdownMenuItem onClick={() => onUnnest(page)}>
                  Unnest
                </DropdownMenuItem>
              )}
              {(canMoveUp || canMoveDown || canNest || canUnnest) && (
                <DropdownMenuSeparator />
              )}
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete(node)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div role="group">
          {node.children.map((child) => (
            <PageTreeItem
              key={child.page.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              toggleExpand={toggleExpand}
              selectedPageId={selectedPageId}
              workspaceSlug={workspaceSlug}
              onNavigate={onNavigate}
              onCreate={onCreate}
              onDelete={onDelete}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
              onNest={onNest}
              onUnnest={onUnnest}
              draggedId={draggedId}
              dropTarget={dropTarget}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
              pages={pages}
            />
          ))}
        </div>
      )}
    </div>
  );
}
