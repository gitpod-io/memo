"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { getClient } from "@/lib/supabase/lazy-client";
import {
  captureSupabaseError,
  isInsufficientPrivilegeError,
  isSchemaNotFoundError,
} from "@/lib/sentry";
import { duplicateDatabase } from "@/lib/database";
import { trackEventClient } from "@/lib/track-event";

interface PageInfo {
  id: string;
  title: string;
  icon: string | null;
  is_database: boolean;
}

interface UsePageActionsParams {
  workspaceId: string;
  workspaceSlug: string;
  userId: string;
}

export interface PageActions {
  handleDelete: (page: PageInfo) => Promise<void>;
  handleDuplicate: (page: PageInfo) => Promise<void>;
  handleToggleFavorite: (
    pageId: string,
    favoriteId: string | undefined,
  ) => Promise<void>;
}

/**
 * Provides page actions (delete, duplicate, favorite toggle) for use outside
 * the sidebar page tree. Uses router.refresh() to sync server-rendered lists
 * after mutations instead of managing local state.
 */
export function usePageActions({
  workspaceId,
  workspaceSlug,
  userId,
}: UsePageActionsParams): PageActions {
  const router = useRouter();

  const handleDelete = useCallback(
    async (page: PageInfo) => {
      const supabase = await getClient();
      const { error } = await supabase.rpc("soft_delete_page", {
        page_id: page.id,
      });

      if (error) {
        captureSupabaseError(error, "page-actions:soft-delete-page");
        toast.error("Failed to delete page", { duration: 8000 });
        return;
      }

      trackEventClient(supabase, "page.deleted", userId, {
        workspaceId,
        metadata: { page_id: page.id, source: "workspace-home" },
      });

      router.refresh();
      window.dispatchEvent(new CustomEvent("trash-changed"));
      window.dispatchEvent(new CustomEvent("pages-changed"));

      toast("Page moved to trash", {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: async () => {
            const client = await getClient();
            const { error: restoreError } = await client.rpc("restore_page", {
              page_id: page.id,
            });

            if (restoreError) {
              captureSupabaseError(restoreError, "page-actions:undo-delete");
              toast.error("Failed to undo delete", { duration: 8000 });
              return;
            }

            router.refresh();
            window.dispatchEvent(new CustomEvent("pages-changed"));
            window.dispatchEvent(new CustomEvent("trash-changed"));
          },
        },
      });
    },
    [workspaceId, userId, router],
  );

  const handleDuplicate = useCallback(
    async (page: PageInfo) => {
      const supabase = await getClient();
      const duplicateTitle = (page.title || "Untitled") + " (copy)";

      // Fetch content on-demand
      const { data: fullPage } = await supabase
        .from("pages")
        .select("content, parent_id, position")
        .eq("id", page.id)
        .single();

      const parentId = fullPage?.parent_id ?? null;
      const position = (fullPage?.position ?? 0) + 1;

      if (page.is_database) {
        const { data: newDbPage, error: dbError } = await duplicateDatabase(
          page.id,
          workspaceId,
          userId,
          duplicateTitle,
          parentId,
          page.icon,
          position,
          (fullPage?.content as Record<string, unknown> | null) ?? null,
        );

        if (dbError || !newDbPage) {
          if (dbError)
            captureSupabaseError(dbError, "page-actions:duplicate-database");
          toast.error("Failed to duplicate database", { duration: 8000 });
          return;
        }

        toast.success("Database duplicated");
        router.refresh();
        window.dispatchEvent(new CustomEvent("pages-changed"));
        router.push(`/${workspaceSlug}/${newDbPage.id}`);
        return;
      }

      const { data: newPage, error } = await supabase
        .from("pages")
        .insert({
          workspace_id: workspaceId,
          parent_id: parentId,
          title: duplicateTitle,
          content: fullPage?.content
            ? JSON.parse(JSON.stringify(fullPage.content))
            : null,
          icon: page.icon,
          position,
          created_by: userId,
        })
        .select()
        .single();

      if (error) {
        if (
          !isSchemaNotFoundError(error) &&
          !isInsufficientPrivilegeError(error)
        ) {
          captureSupabaseError(error, "page-actions:duplicate-page");
        }
        toast.error("Failed to duplicate page", { duration: 8000 });
        return;
      }
      if (!newPage) return;

      trackEventClient(supabase, "page.created", userId, {
        workspaceId,
        metadata: { page_id: newPage.id, source: "workspace-home-duplicate" },
      });

      toast.success("Page duplicated");
      router.refresh();
      window.dispatchEvent(new CustomEvent("pages-changed"));
      router.push(`/${workspaceSlug}/${newPage.id}`);
    },
    [workspaceId, workspaceSlug, userId, router],
  );

  const handleToggleFavorite = useCallback(
    async (pageId: string, favoriteId: string | undefined) => {
      const supabase = await getClient();

      if (favoriteId) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("id", favoriteId);

        if (error) {
          if (!isSchemaNotFoundError(error)) {
            captureSupabaseError(error, "page-actions:remove-favorite");
          }
          toast.error("Failed to remove favorite", { duration: 8000 });
          return;
        }

        trackEventClient(supabase, "sidebar.favorites.toggle", userId, {
          workspaceId,
          metadata: { page_id: pageId, action: "remove" },
        });
        window.dispatchEvent(new CustomEvent("favorites-changed"));
      } else {
        const { error } = await supabase.from("favorites").insert({
          workspace_id: workspaceId,
          user_id: userId,
          page_id: pageId,
        });

        if (error) {
          if (
            !isSchemaNotFoundError(error) &&
            !isInsufficientPrivilegeError(error)
          ) {
            captureSupabaseError(error, "page-actions:add-favorite");
          }
          toast.error("Failed to add favorite", { duration: 8000 });
          return;
        }

        trackEventClient(supabase, "sidebar.favorites.toggle", userId, {
          workspaceId,
          metadata: { page_id: pageId, action: "add" },
        });
        window.dispatchEvent(new CustomEvent("favorites-changed"));
      }
    },
    [workspaceId, userId],
  );

  return { handleDelete, handleDuplicate, handleToggleFavorite };
}
