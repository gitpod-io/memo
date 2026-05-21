"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  Copy,
  FileText,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  Star,
  StarOff,
  Table2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SidebarPage } from "@/lib/types";
import { getSortedSiblings, type TreeNode } from "@/lib/page-tree";
import type { DropIndicator } from "@/components/sidebar/page-tree-drag-layer";

export interface PageTreeItemProps {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  toggleExpand: (id: string) => void;
  selectedPageId: string | undefined;
  focusedId?: string | null;
  tabbableId?: string | null;
  renamingId?: string | null;
  onNavigate: (pageId: string) => void;
  onPrefetch: (pageId: string) => void;
  onCreate: (parentId: string | null) => void;
  onDuplicate: (page: SidebarPage) => void;
  onDelete: (node: TreeNode) => void;
  onRename: (pageId: string, newTitle: string) => void;
  onStartRename: (pageId: string | null) => void;
  onMoveUp: (page: SidebarPage) => void;
  onMoveDown: (page: SidebarPage) => void;
  onNest: (page: SidebarPage) => void;
  onUnnest: (page: SidebarPage) => void;
  draggedId: string | null;
  dropTarget: DropIndicator | null;
  onDragStart: (e: React.DragEvent, pageId: string) => void;
  onDragOver: (e: React.DragEvent, targetId: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  pages: SidebarPage[];
  favoriteMap: Map<string, string>;
  onToggleFavorite: (pageId: string) => void;
}

export function PageTreeItem({
  node,
  depth,
  expanded,
  toggleExpand,
  selectedPageId,
  onNavigate,
  onPrefetch,
  onCreate,
  onDuplicate,
  onDelete,
  onRename,
  onStartRename,
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
  focusedId,
  tabbableId,
  renamingId,
}: PageTreeItemProps) {
  const { page } = node;
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(page.id);
  const isSelected = selectedPageId === page.id;
  const isDragged = draggedId === page.id;
  const isDropTarget = dropTarget?.id === page.id;
  const isFavorited = favoriteMap.has(page.id);
  const isFocused = focusedId === page.id;
  const isTabbable = tabbableId === page.id;
  const isRenaming = renamingId === page.id;

  const renameInputRef = useRef<HTMLInputElement>(null);
  const [renameValue, setRenameValue] = useState(page.title);
  const prevRenamingRef = useRef(false);

  // Reset value and focus when entering rename mode
  useEffect(() => {
    const wasRenaming = prevRenamingRef.current;
    prevRenamingRef.current = isRenaming;

    if (isRenaming && !wasRenaming) {
      // Entering rename mode — schedule state update + focus for next frame
      // to avoid synchronous setState inside an effect
      requestAnimationFrame(() => {
        setRenameValue(page.title);
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      });
    }
  }, [isRenaming, page.title]);

  function commitRename() {
    const trimmed = renameValue.trim();
    if (trimmed !== page.title) {
      onRename(page.id, trimmed);
    }
    onStartRename(null);
  }

  function cancelRename() {
    setRenameValue(page.title);
    onStartRename(null);
  }

  const siblings = getSortedSiblings(pages, page.parent_id);
  const siblingIdx = siblings.findIndex((p) => p.id === page.id);
  const canNest = siblingIdx > 0;
  const canUnnest = page.parent_id !== null;
  const canMoveUp = siblingIdx > 0;
  const canMoveDown = siblingIdx < siblings.length - 1;

  return (
    <div role="treeitem" aria-selected={isSelected} aria-expanded={hasChildren ? isExpanded : undefined}>
      <div
        tabIndex={isTabbable ? 0 : -1}
        data-page-id={page.id}
        className={`group relative flex items-center gap-0.5 py-0.5 pr-1 text-sm outline-none ${
          isFocused ? "ring-1 ring-accent" : ""
        } ${
          isSelected
            ? "bg-overlay-active font-medium text-label-subtle"
            : "text-muted-foreground hover:bg-overlay-hover"
        } ${isDragged ? "opacity-50" : ""}`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        draggable
        onMouseEnter={() => onPrefetch(page.id)}
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
          className="flex h-4 w-4 shrink-0 items-center justify-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
          ) : page.is_database ? (
            <Table2 className="h-4 w-4" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
        </span>

        {isRenaming ? (
          <input
            ref={renameInputRef}
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitRename();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancelRename();
              }
              // Stop propagation to prevent tree keyboard navigation
              e.stopPropagation();
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 truncate bg-transparent text-left text-sm outline-none ring-1 ring-accent rounded-sm px-0.5"
            aria-label="Rename page"
            data-testid="rename-input"
          />
        ) : (
          <button
            className="flex-1 truncate text-left focus-visible:bg-overlay-active focus-visible:outline-none"
            onClick={() => onNavigate(page.id)}
            tabIndex={-1}
            title={page.title || "Untitled"}
          >
            {page.title || "Untitled"}
          </button>
        )}

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
              <DropdownMenuItem onClick={() => onStartRename(page.id)}>
                <Pencil className="h-4 w-4" />
                Rename
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
              focusedId={focusedId}
              tabbableId={tabbableId}
              renamingId={renamingId}
              onNavigate={onNavigate}
              onPrefetch={onPrefetch}
              onCreate={onCreate}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onRename={onRename}
              onStartRename={onStartRename}
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
