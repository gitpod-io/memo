"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FileText, Plus, Table2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { getClient } from "@/lib/supabase/lazy-client";
import {
  captureSupabaseError,
  isSchemaNotFoundError,
} from "@/lib/sentry";
import { retryOnNetworkError } from "@/lib/retry";
import { usePersistedExpanded } from "@/lib/use-persisted-expanded";
import { Button } from "@/components/ui/button";
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
import { buildTree, type TreeNode } from "@/lib/page-tree";
import { usePageTreeActions } from "@/components/sidebar/use-page-tree-actions";
import { usePageTreeDrag } from "@/components/sidebar/page-tree-drag-layer";
import { PageTreeItem } from "@/components/sidebar/page-tree-item";

interface PageTreeProps {
  userId: string;
}

export function PageTree({ userId }: PageTreeProps) {
  const router = useRouter();
  const params = useParams<{ workspaceSlug?: string; pageId?: string }>();
  const [pages, setPages] = useState<SidebarPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<TreeNode | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    await actions.handleDelete(deleteTarget);
    setDeleting(false);
    setDeleteTarget(null);
  }

  if (!workspaceSlug) return null;

  return (
    <div className="flex flex-1 flex-col gap-1 overflow-y-auto" data-testid="sb-page-tree">
      <p className="px-2 text-xs tracking-widest uppercase text-label-faint">
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
              onNavigate={(pageId) =>
                router.push(`/${workspaceSlug}/${pageId}`)
              }
              onPrefetch={(pageId) =>
                router.prefetch(`/${workspaceSlug}/${pageId}`)
              }
              onCreate={actions.handleCreate}
              onDuplicate={actions.handleDuplicate}
              onDelete={setDeleteTarget}
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
          ))}
        </div>
      )}

      <Button
        variant="ghost"
        className="mt-1 w-full justify-start gap-2 px-2 text-muted-foreground"
        size="sm"
        onClick={() => actions.handleCreate(null)}
        data-testid="sb-new-page-btn"
      >
        <Plus className="h-4 w-4" />
        New Page
      </Button>
      <Button
        variant="ghost"
        className="w-full justify-start gap-2 px-2 text-muted-foreground"
        size="sm"
        onClick={actions.handleCreateDatabase}
        data-testid="sb-new-database-btn"
      >
        <Table2 className="h-4 w-4" />
        New Database
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
