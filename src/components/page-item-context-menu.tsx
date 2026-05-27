"use client";

import type { ReactNode } from "react";
import {
  Copy,
  ExternalLink,
  MousePointerClick,
  Star,
  StarOff,
  Trash2,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface PageItemContextMenuProps {
  pageId: string;
  pageTitle: string;
  pageIcon: string | null;
  isDatabase: boolean;
  isFavorited: boolean;
  favoriteId: string | undefined;
  workspaceSlug: string;
  onOpen: (pageId: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  children: ReactNode;
}

export function PageItemContextMenu({
  pageId,
  isFavorited,
  workspaceSlug,
  onOpen,
  onDuplicate,
  onDelete,
  onToggleFavorite,
  children,
}: PageItemContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger className="flex flex-col" data-testid={`wh-ctx-trigger-${pageId}`}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent data-testid="wh-context-menu">
        <ContextMenuItem
          onClick={() => onOpen(pageId)}
          data-testid="wh-ctx-open"
        >
          <MousePointerClick className="h-4 w-4" />
          Open
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => {
            window.open(`/${workspaceSlug}/${pageId}`, "_blank");
          }}
          data-testid="wh-ctx-open-new-tab"
        >
          <ExternalLink className="h-4 w-4" />
          Open in new tab
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={onToggleFavorite}
          data-testid="wh-ctx-toggle-favorite"
        >
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
        </ContextMenuItem>
        <ContextMenuItem
          onClick={onDuplicate}
          data-testid="wh-ctx-duplicate"
        >
          <Copy className="h-4 w-4" />
          Duplicate
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          variant="destructive"
          onClick={onDelete}
          data-testid="wh-ctx-delete"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
