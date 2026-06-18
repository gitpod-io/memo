"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FileText, Plus, Table2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { getClient } from "@/lib/supabase/lazy-client";
import {
  captureSupabaseError,
  isSchemaNotFoundError,
} from "@/lib/sentry";
import { retryOnNetworkError, retryOnTransientError } from "@/lib/retry";
import { useWorkspace } from "@/components/sidebar/workspace-context";
import { usePersistedExpanded } from "@/lib/use-persisted-expanded";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import type { SidebarPage } from "@/lib/types";
import { useSidebar } from "@/components/sidebar/sidebar-context";
import {
  buildTree,
  findParentNode,
  getVisibleItems,
  type TreeNode,
} from "@/lib/page-tree";
import { usePageTreeActions } from "@/components/sidebar/use-page-tree-actions";
import { usePageTreeDrag } from "@/components/sidebar/page-tree-drag-layer";
import { PageTreeItem } from "@/components/sidebar/page-tree-item";

interface PageTreeProps {
  userId: string;
}

export function PageTree({ userId }: PageTreeProps) {
  const router = useRouter();
  const params = useParams<{ workspaceSlug?: string; pageId?: string }>();
  const { isMac } = useSidebar();
  const { workspaceId, workspaceSlug } = useWorkspace();
  const [pages, setPages] = useState<SidebarPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<TreeNode | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  // Map of page_id → favorite row id for quick lookup and deletion
  const [favoriteMap, setFavoriteMap] = useState<Map<string, string>>(new Map());
  const [favRefetchKey, setFavRefetchKey] = useState(0);
  const [pagesRefetchKey, setPagesRefetchKey] = useState(0);

  const { expanded, setExpanded, removeFromPersisted } =
    usePersistedExpanded(workspaceId);

  useEffect(() => {
    if (!workspaceId) return;

    let cancelled = false;

    async function fetchPages() {
      const { data, error } = await retryOnTransientError(async () => {
        const supabase = await getClient();
        return supabase
          .from("pages")
          .select("id, workspace_id, parent_id, title, icon, cover_url, is_database, position, created_by, created_at, updated_at, deleted_at")
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

  const actions = usePageTreeActions({
    workspaceId,
    workspaceSlug,
    userId,
    pages,
    setPages,
    favoriteMap,
    setFavoriteMap,
    setExpanded,
    removeFromPersisted,
    currentPageId: params.pageId,
  });

  const drag = usePageTreeDrag({
    pages,
    tree,
    setPages,
    setExpanded,
  });

  // --- Keyboard navigation (WAI-ARIA Treeview pattern) ---
  const treeRef = useRef<HTMLDivElement>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const visibleItems = useMemo(
    () => getVisibleItems(tree, expanded),
    [tree, expanded],
  );

  // Virtualization — only render visible rows in the DOM
  const ITEM_HEIGHT = 28;
  const OVERSCAN = 10;
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: visibleItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: OVERSCAN,
  });

  // Scroll the selected page into view when navigation changes.
  // Without this, a newly created or navigated-to page at the bottom of a
  // long list would be outside the virtualizer's rendered window.
  const selectedPageId = params.pageId;
  useEffect(() => {
    if (!selectedPageId) return;
    const idx = visibleItems.findIndex(
      (item) => item.node.page.id === selectedPageId,
    );
    if (idx >= 0) {
      virtualizer.scrollToIndex(idx, { align: "auto" });
    }
  }, [selectedPageId, visibleItems, virtualizer]);

  // Focus the DOM element for the currently focused treeitem.
  // With virtualization, the target element may not be in the DOM yet,
  // so scroll it into view first and retry focus after a frame.
  const focusItem = useCallback((pageId: string) => {
    setFocusedId(pageId);
    const idx = visibleItems.findIndex((item) => item.node.page.id === pageId);
    if (idx >= 0) {
      virtualizer.scrollToIndex(idx, { align: "auto" });
    }
    // The element may not be rendered yet after scrollToIndex; retry after paint
    requestAnimationFrame(() => {
      const el = treeRef.current?.querySelector(
        `[data-page-id="${pageId}"]`,
      ) as HTMLElement | null;
      el?.focus();
    });
  }, [visibleItems, virtualizer]);

  // The item that should have tabIndex=0 (roving tabindex pattern).
  // If a focusedId is set, that item is tabbable. Otherwise the first visible
  // item is tabbable so the tree can receive focus via Tab.
  const tabbableId = focusedId ?? (visibleItems.length > 0 ? visibleItems[0].node.page.id : null);

  // Sync focusedId when any treeitem row receives focus (click, Tab, .focus())
  const handleTreeFocus = useCallback(
    (e: React.FocusEvent) => {
      if (!(e.target instanceof HTMLElement)) return;
      const pageId = e.target.getAttribute("data-page-id");
      if (pageId) {
        setFocusedId(pageId);
      }
    },
    [],
  );

  const handleTreeKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (visibleItems.length === 0) return;

      const currentIdx = focusedId
        ? visibleItems.findIndex((item) => item.node.page.id === focusedId)
        : -1;
      const currentItem = currentIdx >= 0 ? visibleItems[currentIdx] : null;
      const currentNode = currentItem?.node ?? null;

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const nextIdx = currentIdx < visibleItems.length - 1
            ? currentIdx + 1
            : 0;
          focusItem(visibleItems[nextIdx].node.page.id);
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const prevIdx = currentIdx > 0
            ? currentIdx - 1
            : visibleItems.length - 1;
          focusItem(visibleItems[prevIdx].node.page.id);
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          if (!currentNode) break;
          const hasChildren = currentNode.children.length > 0;
          const isExpanded = expanded.has(currentNode.page.id);
          if (hasChildren && !isExpanded) {
            // Expand collapsed parent
            toggleExpand(currentNode.page.id);
          } else if (hasChildren && isExpanded) {
            // Move to first child
            focusItem(currentNode.children[0].page.id);
          }
          // Leaf: do nothing
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          if (!currentNode) break;
          const hasKids = currentNode.children.length > 0;
          const isOpen = expanded.has(currentNode.page.id);
          if (hasKids && isOpen) {
            // Collapse expanded parent
            toggleExpand(currentNode.page.id);
          } else {
            // Move to parent
            const parent = findParentNode(tree, currentNode.page.id);
            if (parent) {
              focusItem(parent.page.id);
            }
          }
          break;
        }
        case "Enter": {
          e.preventDefault();
          if (currentNode && workspaceSlug) {
            router.push(`/${workspaceSlug}/${currentNode.page.id}`);
          }
          break;
        }
        case "Home": {
          e.preventDefault();
          if (visibleItems.length > 0) {
            focusItem(visibleItems[0].node.page.id);
          }
          break;
        }
        case "End": {
          e.preventDefault();
          if (visibleItems.length > 0) {
            focusItem(visibleItems[visibleItems.length - 1].node.page.id);
          }
          break;
        }
        default:
          return; // Don't prevent default for unhandled keys
      }
    },
    [visibleItems, focusedId, expanded, toggleExpand, tree, focusItem, workspaceSlug, router],
  );

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    await actions.handleDelete(deleteTarget);
    setDeleting(false);
    setDeleteTarget(null);
  }

  if (!workspaceSlug) return null;

  return (
    <div className="flex flex-1 flex-col gap-1 overflow-hidden" data-testid="sb-page-tree">
      <p className="shrink-0 px-2 text-xs tracking-widest uppercase text-label-faint">
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
          ref={scrollRef}
          className="flex-1 overflow-y-auto"
        >
          <div
            ref={treeRef}
            role="tree"
            aria-label="Page tree"
            onFocus={handleTreeFocus}
            onKeyDown={handleTreeKeyDown}
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const { node, depth } = visibleItems[virtualItem.index];
              return (
                <div
                  key={node.page.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <PageTreeItem
                    node={node}
                    depth={depth}
                    expanded={expanded}
                    toggleExpand={toggleExpand}
                    selectedPageId={selectedPageId}
                    focusedId={focusedId}
                    tabbableId={tabbableId}
                    renamingId={renamingId}
                    href={`/${workspaceSlug}/${node.page.id}`}
                    onCreate={actions.handleCreate}
                    onDuplicate={actions.handleDuplicate}
                    onDelete={setDeleteTarget}
                    onRename={actions.handleRename}
                    onStartRename={setRenamingId}
                    onMoveUp={actions.handleMoveUp}
                    onMoveDown={actions.handleMoveDown}
                    onNest={actions.handleNest}
                    onUnnest={actions.handleUnnest}
                    draggedId={drag.draggedId}
                    dropTarget={drag.dropTarget}
                    onDragStart={drag.onDragStart}
                    onDragOver={drag.onDragOver}
                    onDragLeave={drag.onDragLeave}
                    onDrop={drag.onDrop}
                    onDragEnd={drag.onDragEnd}
                    pages={pages}
                    favoriteMap={favoriteMap}
                    onToggleFavorite={actions.handleToggleFavorite}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                className="mt-1 w-full shrink-0 justify-start gap-2 px-2 text-muted-foreground"
                size="sm"
                onClick={() => actions.handleCreate(null)}
                data-testid="sb-new-page-btn"
              />
            }
          >
            <Plus className="h-4 w-4" />
            New Page
          </TooltipTrigger>
          <TooltipContent side="right">
            New Page
            <kbd data-slot="kbd">{isMac ? "⌘" : "Ctrl+"}N</kbd>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                className="w-full shrink-0 justify-start gap-2 px-2 text-muted-foreground"
                size="sm"
                onClick={actions.handleCreateDatabase}
                data-testid="sb-new-database-btn"
              />
            }
          >
            <Table2 className="h-4 w-4" />
            New Database
          </TooltipTrigger>
          <TooltipContent side="right">
            New Database
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

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
              onClick={handleDeleteConfirm}
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
