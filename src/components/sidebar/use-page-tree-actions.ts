"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { getClient } from "@/lib/supabase/lazy-client";
import {
  captureSupabaseError,
  isForeignKeyViolationError,
  isInsufficientPrivilegeError,
  isSchemaNotFoundError,
} from "@/lib/sentry";
import { trackEventClient } from "@/lib/track-event";
import { createDatabase } from "@/lib/database";
import type { SidebarPage } from "@/lib/types";
import {
  computeNest,
  computeSwapPositions,
  computeUnnest,
  getDescendantIds,
  getNextSiblingPosition,
  type TreeNode,
} from "@/lib/page-tree";

interface UsePageTreeActionsParams {
  workspaceId: string | null;
  workspaceSlug: string | undefined;
  userId: string;
  pages: SidebarPage[];
  setPages: React.Dispatch<React.SetStateAction<SidebarPage[]>>;
  favoriteMap: Map<string, string>;
  setFavoriteMap: React.Dispatch<React.SetStateAction<Map<string, string>>>;
  setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>;
  removeFromPersisted: (ids: Set<string>) => void;
  currentPageId: string | undefined;
}

export interface PageTreeActions {
  handleCreate: (parentId: string | null) => Promise<void>;
  handleCreateDatabase: () => Promise<void>;
  handleDuplicate: (page: SidebarPage) => Promise<void>;
  handleDelete: (deleteTarget: TreeNode) => Promise<void>;
  handleMoveUp: (page: SidebarPage) => Promise<void>;
  handleMoveDown: (page: SidebarPage) => Promise<void>;
  handleNest: (page: SidebarPage) => Promise<void>;
  handleUnnest: (page: SidebarPage) => Promise<void>;
  handleToggleFavorite: (pageId: string) => Promise<void>;
}

export function usePageTreeActions({
  workspaceId,
  workspaceSlug,
  userId,
  pages,
  setPages,
  favoriteMap,
  setFavoriteMap,
  setExpanded,
  removeFromPersisted,
  currentPageId,
}: UsePageTreeActionsParams): PageTreeActions {
  const router = useRouter();

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
          if (
            !isSchemaNotFoundError(error) &&
            !isInsufficientPrivilegeError(error)
          ) {
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
    [workspaceId, userId, favoriteMap, setFavoriteMap],
  );

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
        if (
          !isSchemaNotFoundError(error) &&
          !isInsufficientPrivilegeError(error) &&
          !isForeignKeyViolationError(error)
        ) {
          captureSupabaseError(error, "page-tree:create-page");
        }
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
    [workspaceId, workspaceSlug, pages, userId, router, setExpanded, setPages],
  );

  const handleCreateDatabase = useCallback(async () => {
    if (!workspaceId || !workspaceSlug) return;

    const { data, error } = await createDatabase(workspaceId, userId);

    if (error || !data) {
      toast.error("Failed to create database", { duration: 8000 });
      return;
    }

    const supabase = await getClient();
    trackEventClient(supabase, "database.created", userId, {
      workspaceId,
      metadata: { page_id: data.page.id, source: "sidebar" },
    });

    setPages((prev) => [...prev, data.page]);
    router.push(`/${workspaceSlug}/${data.page.id}`);
    router.refresh();
  }, [workspaceId, workspaceSlug, userId, router, setPages]);

  const handleDuplicate = useCallback(
    async (page: SidebarPage) => {
      if (!workspaceId || !workspaceSlug) return;

      const nextPosition = getNextSiblingPosition(pages, page.parent_id);
      const duplicateTitle = (page.title || "Untitled") + " (copy)";

      // Fetch content on-demand — the sidebar tree query excludes it to reduce payload
      const supabase = await getClient();
      const { data: fullPage } = await supabase
        .from("pages")
        .select("content")
        .eq("id", page.id)
        .single();

      const { data: newPage, error } = await supabase
        .from("pages")
        .insert({
          workspace_id: workspaceId,
          parent_id: page.parent_id,
          title: duplicateTitle,
          content: fullPage?.content ? JSON.parse(JSON.stringify(fullPage.content)) : null,
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
    [workspaceId, workspaceSlug, pages, userId, router, setPages],
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

  const handleDelete = useCallback(
    async (deleteTarget: TreeNode) => {
      const supabase = await getClient();
      const { error } = await supabase.rpc("soft_delete_page", {
        page_id: deleteTarget.page.id,
      });

      if (error) {
        captureSupabaseError(error, "page-tree:soft-delete-page");
        toast.error("Failed to delete page", { duration: 8000 });
        return;
      }

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

      if (currentPageId && removedIds.has(currentPageId)) {
        router.push(`/${workspaceSlug}`);
      }

      toast("Page moved to trash", { duration: 4000 });
      window.dispatchEvent(new CustomEvent("trash-changed"));
    },
    [userId, workspaceId, workspaceSlug, currentPageId, router, setPages, removeFromPersisted],
  );

  const applySwap = useCallback(
    async (updates: Array<{ id: string; position: number }>) => {
      const supabase = await getClient();

      setPages((prev) =>
        prev.map((p) => {
          const update = updates.find((u) => u.id === p.id);
          return update ? { ...p, position: update.position } : p;
        }),
      );

      const results = await Promise.all(
        updates.map((u) =>
          supabase.from("pages").update({ position: u.position }).eq("id", u.id),
        ),
      );

      for (const result of results) {
        if (result.error) {
          captureSupabaseError(result.error, "page-tree:swap-positions");
          toast.error("Failed to reorder page", { duration: 8000 });
          break;
        }
      }
    },
    [setPages],
  );

  const handleMoveUp = useCallback(
    async (page: SidebarPage) => {
      const result = computeSwapPositions(pages, page.id, "up");
      if (!result) return;
      await applySwap(result.updates);
    },
    [pages, applySwap],
  );

  const handleMoveDown = useCallback(
    async (page: SidebarPage) => {
      const result = computeSwapPositions(pages, page.id, "down");
      if (!result) return;
      await applySwap(result.updates);
    },
    [pages, applySwap],
  );

  const handleNest = useCallback(
    async (page: SidebarPage) => {
      const result = computeNest(pages, page.id);
      if (!result) return;

      const { parentId, position } = result;
      const supabase = await getClient();

      setPages((prev) =>
        prev.map((p) =>
          p.id === page.id
            ? { ...p, parent_id: parentId, position }
            : p,
        ),
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
    },
    [pages, setPages, setExpanded],
  );

  const handleUnnest = useCallback(
    async (page: SidebarPage) => {
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
        }),
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
            .eq("id", s.id),
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
    },
    [pages, setPages],
  );

  return {
    handleCreate,
    handleCreateDatabase,
    handleDuplicate,
    handleDelete,
    handleMoveUp,
    handleMoveDown,
    handleNest,
    handleUnnest,
    handleToggleFavorite,
  };
}
