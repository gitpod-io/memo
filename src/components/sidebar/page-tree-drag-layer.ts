"use client";

import { useCallback, useState } from "react";
import { toast } from "@/lib/toast";
import { getClient } from "@/lib/supabase/lazy-client";
import {
  captureSupabaseError,
  isInsufficientPrivilegeError,
} from "@/lib/sentry";
import type { SidebarPage } from "@/lib/types";
import { computeDrop, type TreeNode } from "@/lib/page-tree";

export interface DropIndicator {
  id: string;
  position: "before" | "after" | "inside";
}

export interface PageTreeDragState {
  draggedId: string | null;
  dropTarget: DropIndicator | null;
  onDragStart: (e: React.DragEvent, pageId: string) => void;
  onDragOver: (e: React.DragEvent, targetId: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

interface UsePageTreeDragParams {
  pages: SidebarPage[];
  tree: TreeNode[];
  setPages: React.Dispatch<React.SetStateAction<SidebarPage[]>>;
  setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export function usePageTreeDrag({
  pages,
  tree,
  setPages,
  setExpanded,
}: UsePageTreeDragParams): PageTreeDragState {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropIndicator | null>(null);

  const onDragStart = useCallback((e: React.DragEvent, pageId: string) => {
    setDraggedId(pageId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", pageId);
  }, []);

  const onDragOver = useCallback(
    (e: React.DragEvent, targetId: string) => {
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
    },
    [draggedId],
  );

  const onDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
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
          if (!isInsufficientPrivilegeError(error)) {
            captureSupabaseError(error, "page-tree:drop-reorder");
          }
          toast.error("Failed to move page", { duration: 8000 });
          break;
        }
      }

      setDraggedId(null);
      setDropTarget(null);
    },
    [draggedId, dropTarget, pages, tree, setPages, setExpanded],
  );

  const onDragEnd = useCallback(() => {
    setDraggedId(null);
    setDropTarget(null);
  }, []);

  return {
    draggedId,
    dropTarget,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragEnd,
  };
}
