"use client";

import {
  ChevronRight,
  Copy,
  FileText,
  GripVertical,
  MoreHorizontal,
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
  onNavigate: (pageId: string) => void;
  onPrefetch: (pageId: string) => void;
  onCreate: (parentId: string | null) => void;
  onDuplicate: (page: SidebarPage) => void;
  onDelete: (node: TreeNode) => void;
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
          ) : page.is_database ? (
            <Table2 className="h-4 w-4" />
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
              onNavigate={onNavigate}
              onPrefetch={onPrefetch}
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
