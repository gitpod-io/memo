"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronRight,
  Copy,
  FileText,
  GripVertical,
  MoreHorizontal,
  Plus,
  Star,
  StarOff,
  Trash2,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { getClient } from "@/lib/supabase/lazy-client";
import { captureSupabaseError, isSchemaNotFoundError } from "@/lib/sentry";
import { trackEventClient } from "@/lib/track-event";
import { retryOnNetworkError } from "@/lib/retry";
import { usePersistedExpanded } from "@/lib/use-persisted-expanded";
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
import {
  buildTree,
  computeDrop,
  computeNest,
  computeSwapPositions,
  computeUnnest,
  getDescendantIds,
  getNextSiblingPosition,
  getSortedSiblings,
  type TreeNode,
} from "@/lib/page-tree";

interface PageTreeProps {
  userId: string;
}

export function PageTree({ userId }: PageTreeProps) {
  const router = useRouter();
  const params = useParams<{ workspaceSlug?: string; pageId?: string }>();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<TreeNode | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    position: "before" | "after" | "inside";
  } | null>(null);

  // Map of page_id → favorite row id for quick lookup and deletion
  const [favoriteMap, setFavoriteMap] = useState<Map<string, string>>(new Map());
  const [favRefetchKey, setFavRefetchKey] = useState(0);
  const [pagesRefetchKey, setPagesRefetchKey] = useState(0);

  const workspaceSlug = params.workspaceSlug;

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const { expanded, setExpanded, removeFromPersisted } =
    usePersistedExpanded(workspaceId);

  useEffect(() => {
    if (!workspaceSlug) return;

    let cancelled = false;

    retryOnNetworkError(async () => {
      const supabase = await getClient();
      return supabase
        .from("workspaces")
        .select("id")
        .eq("slug", workspaceSlug)
        .maybeSingle();
    }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        captureSupabaseError(error, "page-tree:workspace-lookup");
        return;
      }
      if (data) setWorkspaceId(data.id);
    });

    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

  useEffect(() => {
    if (!workspaceId) return;

    let cancelled = false;

    async function fetchPages() {
      const { data, error } = await retryOnNetworkError(async () => {
        const supabase = await getClient();
        return supabase
          .from("pages")
          .select("*")
          .eq("workspace_id", workspaceId)
          .is("deleted_at", null)
          .order("position", { ascending: true });
      });

      if (cancelled) return;

      if (error) {
        captureSupabaseError(error, "page-tree:fetch-pages");
        toast.error("Failed to load pages", { duration: 8000 });
      }

      if (data) {
        setPages(data);
      }
      setLoading(false);
    }

    fetchPages();

    return () => {
      cancelled = true;
    };
  }, [workspaceId, pagesRefetchKey]);

  // Re-sync when pages are restored from trash
  useEffect(() => {
    function handlePagesChanged() {
      setPagesRefetchKey((k) => k + 1);
    }
    window.addEventListener("pages-changed", handlePagesChanged);
    return () => window.removeEventListener("pages-changed", handlePagesChanged);
  }, []);

  // Re-sync when other components change favorites
  useEffect(() => {
    function handleFavoritesChanged() {
      setFavRefetchKey((k) => k + 1);
    }
    window.addEventListener("favorites-changed", handleFavoritesChanged);
    return () => window.removeEventListener("favorites-changed", handleFavoritesChanged);
  }, []);

  // Fetch favorites for this user + workspace
  useEffect(() => {
    if (!workspaceId) return;

    let cancelled = false;

    async function fetchFavorites() {
      const { data, error } = await retryOnNetworkError(async () => {
        const supabase = await getClient();
        return supabase
          .from("favorites")
          .select("id, page_id")
          .eq("workspace_id", workspaceId)
          .eq("user_id", userId);
      });

      if (cancelled) return;

      if (error) {
        // Table missing (migration not applied yet) — degrade gracefully
        if (isSchemaNotFoundError(error)) return;
        captureSupabaseError(error, "page-tree:fetch-favorites");
        return;
      }

      if (data) {
        setFavoriteMap(new Map(data.map((f) => [f.page_id, f.id])));
      }
    }

    fetchFavorites();

    return () => {
      cancelled = true;
    };
  }, [workspaceId, userId, favRefetchKey]);

  const handleToggleFavorite = useCallback(
    async (pageId: string) => {
      if (!workspaceId) return;

      const existingFavId = favoriteMap.get(pageId);
      const supabase = await getClient();

      if (existingFavId) {
        // Remove — optimistic
        setFavoriteMap((prev) => {
          const next = new Map(prev);
          next.delete(pageId);
          return next;
        });

        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("id", existingFavId);

        if (error) {
          if (!isSchemaNotFoundError(error)) {
            captureSupabaseError(error, "page-tree:remove-favorite");
          }
          toast.error("Failed to remove favorite", { duration: 8000 });
          // Revert
          setFavoriteMap((prev) => new Map(prev).set(pageId, existingFavId));
        } else {
          trackEventClient(supabase, "sidebar.favorites.toggle", userId, {
            workspaceId,
            metadata: { page_id: pageId, action: "remove" },
          });
          window.dispatchEvent(new CustomEvent("favorites-changed"));
        }
      } else {
        // Add
        const { data, error } = await supabase
          .from("favorites")
          .insert({
            workspace_id: workspaceId,
            user_id: userId,
            page_id: pageId,
          })
          .select("id")
          .single();

        if (error) {
          if (!isSchemaNotFoundError(error)) {
            captureSupabaseError(error, "page-tree:add-favorite");
          }
          toast.error("Failed to add favorite", { duration: 8000 });
          return;
        }

        if (data) {
          trackEventClient(supabase, "sidebar.favorites.toggle", userId, {
            workspaceId,
            metadata: { page_id: pageId, action: "add" },
          });
          setFavoriteMap((prev) => new Map(prev).set(pageId, data.id));
          window.dispatchEvent(new CustomEvent("favorites-changed"));
        }
      }
    },
    [workspaceId, userId, favoriteMap],
  );

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
  }, [setExpanded]);

  const handleCreate = useCallback(
    async (parentId: string | null) => {
      if (!workspaceId || !workspaceSlug) return;

      const nextPosition = getNextSiblingPosition(pages, parentId);

      const supabase = await getClient();
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
        toast.error("Failed to create page", { duration: 8000 });
        return;
      }
      if (!newPage) return;

      trackEventClient(supabase, "page.created", userId, {
        workspaceId,
        metadata: { page_id: newPage.id, source: "sidebar" },
      });

      setPages((prev) => [...prev, newPage]);

      if (parentId) {
        setExpanded((prev) => new Set(prev).add(parentId));
      }

      router.push(`/${workspaceSlug}/${newPage.id}`);
    },
    [workspaceId, workspaceSlug, pages, userId, router, setExpanded],
  );

  const handleDuplicate = useCallback(
    async (page: Page) => {
      if (!workspaceId || !workspaceSlug) return;

      const nextPosition = getNextSiblingPosition(pages, page.parent_id);
      const duplicateTitle = (page.title || "Untitled") + " (copy)";

      const supabase = await getClient();
      const { data: newPage, error } = await supabase
        .from("pages")
        .insert({
          workspace_id: workspaceId,
          parent_id: page.parent_id,
          title: duplicateTitle,
          content: page.content ? JSON.parse(JSON.stringify(page.content)) : null,
          icon: page.icon,
          position: nextPosition,
          created_by: userId,
        })
        .select()
        .single();

      if (error) {
        captureSupabaseError(error, "page-tree:duplicate-page");
        toast.error("Failed to duplicate page", { duration: 8000 });
        return;
      }
      if (!newPage) return;

      setPages((prev) => [...prev, newPage]);
      toast.success("Page duplicated");
      router.push(`/${workspaceSlug}/${newPage.id}`);
    },
    [workspaceId, workspaceSlug, pages, userId, router],
  );

  // ⌘+N / Ctrl+N global shortcut to create a new page
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "n" && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        handleCreate(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCreate]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    const supabase = await getClient();
    const { error } = await supabase.rpc("soft_delete_page", {
      page_id: deleteTarget.page.id,
    });

    if (error) {
      captureSupabaseError(error, "page-tree:soft-delete-page");
      toast.error("Failed to delete page", { duration: 8000 });
    } else {
      trackEventClient(supabase, "page.deleted", userId, {
        workspaceId: workspaceId ?? undefined,
        metadata: { page_id: deleteTarget.page.id },
      });

      const removedIds = new Set([
        deleteTarget.page.id,
        ...getDescendantIds(deleteTarget),
      ]);
      setPages((prev) => prev.filter((p) => !removedIds.has(p.id)));
      removeFromPersisted(removedIds);

      if (params.pageId && removedIds.has(params.pageId)) {
        router.push(`/${workspaceSlug}`);
      }

      toast("Page moved to trash", { duration: 4000 });
      window.dispatchEvent(new CustomEvent("trash-changed"));
    }

    setDeleting(false);
    setDeleteTarget(null);
  }

  async function handleMoveUp(page: Page) {
    const result = computeSwapPositions(pages, page.id, "up");
    if (!result) return;
    await applySwap(result.updates);
  }

  async function handleMoveDown(page: Page) {
    const result = computeSwapPositions(pages, page.id, "down");
    if (!result) return;
    await applySwap(result.updates);
  }

  async function applySwap(
    updates: Array<{ id: string; position: number }>,
  ) {
    const supabase = await getClient();

    setPages((prev) =>
      prev.map((p) => {
        const update = updates.find((u) => u.id === p.id);
        return update ? { ...p, position: update.position } : p;
      })
    );

    const results = await Promise.all(
      updates.map((u) =>
        supabase.from("pages").update({ position: u.position }).eq("id", u.id)
      )
    );

    for (const result of results) {
      if (result.error) {
        captureSupabaseError(result.error, "page-tree:swap-positions");
        toast.error("Failed to reorder page", { duration: 8000 });
        break;
      }
    }
  }

  async function handleNest(page: Page) {
    const result = computeNest(pages, page.id);
    if (!result) return;

    const { parentId, position } = result;
    const supabase = await getClient();

    setPages((prev) =>
      prev.map((p) =>
        p.id === page.id
          ? { ...p, parent_id: parentId, position }
          : p
      )
    );

    setExpanded((prev) => new Set(prev).add(parentId));

    const { error } = await supabase
      .from("pages")
      .update({ parent_id: parentId, position })
      .eq("id", page.id);

    if (error) {
      captureSupabaseError(error, "page-tree:nest-page");
      toast.error("Failed to nest page", { duration: 8000 });
    }
  }

  async function handleUnnest(page: Page) {
    const result = computeUnnest(pages, page.id);
    if (!result) return;

    const { pageUpdate, shiftUpdates } = result;
    const supabase = await getClient();

    setPages((prev) =>
      prev.map((p) => {
        if (p.id === page.id) {
          return { ...p, parent_id: pageUpdate.parentId, position: pageUpdate.position };
        }
        const shift = shiftUpdates.find((s) => s.id === p.id);
        if (shift) {
          return { ...p, position: shift.position };
        }
        return p;
      })
    );

    const dbUpdates = [
      supabase
        .from("pages")
        .update({ parent_id: pageUpdate.parentId, position: pageUpdate.position })
        .eq("id", page.id),
      ...shiftUpdates.map((s) =>
        supabase
          .from("pages")
          .update({ position: s.position })
          .eq("id", s.id)
      ),
    ];

    const results = await Promise.all(dbUpdates);

    for (const r of results) {
      if (r.error) {
        captureSupabaseError(r.error, "page-tree:unnest-page");
        toast.error("Failed to unnest page", { duration: 8000 });
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

    const result = computeDrop(
      pages,
      tree,
      draggedId,
      dropTarget.id,
      dropTarget.position,
    );

    if (!result) {
      setDraggedId(null);
      setDropTarget(null);
      return;
    }

    const supabase = await getClient();

    // Optimistic UI update
    setPages((prev) => {
      const next = [...prev];
      for (const update of result.updates) {
        const idx = next.findIndex((p) => p.id === update.id);
        if (idx !== -1) {
          next[idx] = {
            ...next[idx],
            parent_id: update.parentId,
            position: update.position,
          };
        }
      }
      return next;
    });

    // Expand target when dropping inside
    if (dropTarget.position === "inside") {
      setExpanded((prev) => new Set(prev).add(dropTarget.id));
    }

    // Persist to database
    for (const update of result.updates) {
      const { error } = await supabase
        .from("pages")
        .update({ parent_id: update.parentId, position: update.position })
        .eq("id", update.id);

      if (error) {
        captureSupabaseError(error, "page-tree:drop-reorder");
        toast.error("Failed to move page", { duration: 8000 });
        break;
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
              onDuplicate={handleDuplicate}
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
              favoriteMap={favoriteMap}
              onToggleFavorite={handleToggleFavorite}
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
            <AlertDialogTitle>Move to trash</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && deleteTarget.children.length > 0
                ? `"${deleteTarget.page.title || "Untitled"}" and its ${deleteTarget.children.length} sub-page${deleteTarget.children.length === 1 ? "" : "s"} will be moved to trash. You can restore them later.`
                : `"${deleteTarget?.page.title || "Untitled"}" will be moved to trash. You can restore it later.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Moving…" : "Move to trash"}
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
  onDuplicate: (page: Page) => void;
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
  favoriteMap: Map<string, string>;
  onToggleFavorite: (pageId: string) => void;
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
  onDuplicate,
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
  favoriteMap,
  onToggleFavorite,
}: PageTreeItemProps) {
  const { page } = node;
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(page.id);
  const isSelected = selectedPageId === page.id;
  const isDragged = draggedId === page.id;
  const isDropTarget = dropTarget?.id === page.id;
  const isFavorited = favoriteMap.has(page.id);

  const siblings = getSortedSiblings(pages, page.parent_id);
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
              <DropdownMenuItem onClick={() => onToggleFavorite(page.id)}>
                {isFavorited ? (
                  <>
                    <StarOff className="h-4 w-4" />
                    Remove from favorites
                  </>
                ) : (
                  <>
                    <Star className="h-4 w-4" />
                    Add to favorites
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(page)}>
                <Copy className="h-4 w-4" />
                Duplicate
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
              onDuplicate={onDuplicate}
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
              favoriteMap={favoriteMap}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      )}
    </div>
  );
}
