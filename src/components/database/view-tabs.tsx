"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Calendar,
  Columns3,
  Copy,
  GripVertical,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  Table2,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import type { DatabaseView, DatabaseViewType } from "@/lib/types";

// ---------------------------------------------------------------------------
// View type → icon mapping (exported for reuse)
// ---------------------------------------------------------------------------

export const VIEW_TYPE_ICON: Record<
  DatabaseViewType,
  React.ComponentType<{ className?: string }>
> = {
  table: Table2,
  board: Columns3,
  list: List,
  calendar: Calendar,
  gallery: LayoutGrid,
};

export const VIEW_TYPE_LABELS: Record<DatabaseViewType, string> = {
  table: "Table",
  board: "Board",
  list: "List",
  calendar: "Calendar",
  gallery: "Gallery",
};

const VIEW_TYPES: DatabaseViewType[] = [
  "table",
  "board",
  "list",
  "calendar",
  "gallery",
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ViewTabsProps {
  views: DatabaseView[];
  activeViewId: string;
  onViewChange: (viewId: string) => void;
  onAddView?: (type: DatabaseViewType) => void;
  onRenameView?: (viewId: string, newName: string) => void;
  onDeleteView?: (viewId: string) => void;
  onDuplicateView?: (viewId: string) => void;
  onReorderViews?: (orderedIds: string[]) => void;
}

// ---------------------------------------------------------------------------
// ViewTabs
// ---------------------------------------------------------------------------

export function ViewTabs({
  views,
  activeViewId,
  onViewChange,
  onAddView,
  onRenameView,
  onDeleteView,
  onDuplicateView,
  onReorderViews,
}: ViewTabsProps) {
  // Inline rename state
  const [renamingViewId, setRenamingViewId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation state
  const [deleteViewId, setDeleteViewId] = useState<string | null>(null);
  const deleteViewName = useMemo(
    () => views.find((v) => v.id === deleteViewId)?.name ?? "",
    [views, deleteViewId],
  );

  // Drag-and-drop state
  const [dragViewId, setDragViewId] = useState<string | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  // Context menu state (right-click positioned menu)
  const [contextMenuViewId, setContextMenuViewId] = useState<string | null>(null);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Focus rename input when entering rename mode
  useEffect(() => {
    if (renamingViewId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingViewId]);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenuOpen) return;

    function handleClick(e: MouseEvent) {
      if (
        contextMenuRef.current &&
        e.target instanceof Node &&
        !contextMenuRef.current.contains(e.target)
      ) {
        setContextMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [contextMenuOpen]);

  // ---------------------------------------------------------------------------
  // Tab click
  // ---------------------------------------------------------------------------

  const handleTabClick = useCallback(
    (viewId: string) => {
      if (viewId !== activeViewId && renamingViewId === null) {
        onViewChange(viewId);
      }
    },
    [activeViewId, onViewChange, renamingViewId],
  );

  // ---------------------------------------------------------------------------
  // Inline rename
  // ---------------------------------------------------------------------------

  const startRename = useCallback(
    (viewId: string) => {
      const view = views.find((v) => v.id === viewId);
      if (!view) return;
      setRenamingViewId(viewId);
      setRenameValue(view.name);
      setContextMenuOpen(false);
    },
    [views],
  );

  const confirmRename = useCallback(() => {
    if (renamingViewId && renameValue.trim() && onRenameView) {
      const currentName = views.find((v) => v.id === renamingViewId)?.name;
      if (renameValue.trim() !== currentName) {
        onRenameView(renamingViewId, renameValue.trim());
      }
    }
    setRenamingViewId(null);
    setRenameValue("");
  }, [renamingViewId, renameValue, onRenameView, views]);

  const cancelRename = useCallback(() => {
    setRenamingViewId(null);
    setRenameValue("");
  }, []);

  const handleDoubleClick = useCallback(
    (viewId: string) => {
      if (onRenameView) {
        startRename(viewId);
      }
    },
    [onRenameView, startRename],
  );

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        confirmRename();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelRename();
      }
    },
    [confirmRename, cancelRename],
  );

  // ---------------------------------------------------------------------------
  // Context menu (right-click)
  // ---------------------------------------------------------------------------

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, viewId: string) => {
      e.preventDefault();
      setContextMenuViewId(viewId);
      setContextMenuPosition({ x: e.clientX, y: e.clientY });
      setContextMenuOpen(true);
    },
    [],
  );

  const handleContextMenuAction = useCallback(
    (action: "rename" | "duplicate" | "delete") => {
      if (!contextMenuViewId) return;
      setContextMenuOpen(false);

      switch (action) {
        case "rename":
          startRename(contextMenuViewId);
          break;
        case "duplicate":
          onDuplicateView?.(contextMenuViewId);
          break;
        case "delete":
          setDeleteViewId(contextMenuViewId);
          break;
      }
    },
    [contextMenuViewId, startRename, onDuplicateView],
  );

  // ---------------------------------------------------------------------------
  // Delete confirmation
  // ---------------------------------------------------------------------------

  const confirmDelete = useCallback(() => {
    if (deleteViewId && onDeleteView) {
      onDeleteView(deleteViewId);
    }
    setDeleteViewId(null);
  }, [deleteViewId, onDeleteView]);

  const cancelDelete = useCallback(() => {
    setDeleteViewId(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Drag-and-drop reorder
  // ---------------------------------------------------------------------------

  const handleDragStart = useCallback(
    (e: React.DragEvent, viewId: string) => {
      setDragViewId(viewId);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", viewId);
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropTargetIndex(index);
    },
    [],
  );

  const handleDragLeave = useCallback(() => {
    setDropTargetIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      setDropTargetIndex(null);

      if (!dragViewId || !onReorderViews) {
        setDragViewId(null);
        return;
      }

      const currentIndex = views.findIndex((v) => v.id === dragViewId);
      if (currentIndex === -1 || currentIndex === targetIndex) {
        setDragViewId(null);
        return;
      }

      const orderedIds = views.map((v) => v.id);
      const [movedId] = orderedIds.splice(currentIndex, 1);
      const insertIndex =
        targetIndex > currentIndex ? targetIndex - 1 : targetIndex;
      orderedIds.splice(insertIndex, 0, movedId);

      onReorderViews(orderedIds);
      setDragViewId(null);
    },
    [dragViewId, views, onReorderViews],
  );

  const handleDragEnd = useCallback(() => {
    setDragViewId(null);
    setDropTargetIndex(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const isLastView = views.length <= 1;

  return (
    <>
      <div className="flex items-center border-b border-white/[0.06]">
        <div className="flex items-center gap-0 overflow-x-auto">
          {views.map((view, index) => {
            const Icon = VIEW_TYPE_ICON[view.type];
            const isActive = view.id === activeViewId;
            const isDragging = view.id === dragViewId;
            const showDropIndicator =
              dropTargetIndex === index && dragViewId !== null;

            return (
              <div
                key={view.id}
                className="relative flex items-center"
                draggable={
                  onReorderViews !== undefined && renamingViewId === null
                }
                onDragStart={(e) => handleDragStart(e, view.id)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
              >
                {/* Drop indicator — left edge */}
                {showDropIndicator && (
                  <div className="absolute left-0 top-1 bottom-1 z-10 w-0.5 bg-accent" />
                )}

                <button
                  type="button"
                  onClick={() => handleTabClick(view.id)}
                  onDoubleClick={() => handleDoubleClick(view.id)}
                  onContextMenu={(e) => handleContextMenu(e, view.id)}
                  className={cn(
                    "group/tab flex shrink-0 items-center gap-1.5 px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "border-b-2 border-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                    isDragging && "opacity-50",
                  )}
                >
                  {onReorderViews && (
                    <GripVertical className="h-3 w-3 shrink-0 cursor-grab opacity-0 transition-opacity group-hover/tab:opacity-50" />
                  )}
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {renamingViewId === view.id ? (
                    <input
                      ref={renameInputRef}
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={handleRenameKeyDown}
                      onBlur={confirmRename}
                      className="w-24 bg-transparent text-sm outline-none border-b border-accent"
                      aria-label="Rename view"
                    />
                  ) : (
                    <span>{view.name}</span>
                  )}
                </button>
              </div>
            );
          })}

          {/* Drop indicator at the end */}
          {dropTargetIndex === views.length && dragViewId !== null && (
            <div className="relative">
              <div className="absolute left-0 top-1 bottom-1 z-10 w-0.5 bg-accent" />
            </div>
          )}

          {/* Drop zone at the end of the list */}
          {onReorderViews && (
            <div
              className="h-8 w-4 shrink-0"
              onDragOver={(e) => handleDragOver(e, views.length)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, views.length)}
            />
          )}
        </div>

        {/* Add view button with type picker dropdown */}
        {onAddView && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="ml-1 flex shrink-0 items-center p-2 text-muted-foreground transition-colors hover:text-foreground outline-none"
              aria-label="Add view"
            >
              <Plus className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="start" sideOffset={4}>
              {VIEW_TYPES.map((type) => {
                const TypeIcon = VIEW_TYPE_ICON[type];
                return (
                  <DropdownMenuItem
                    key={type}
                    onClick={() => onAddView(type)}
                  >
                    <TypeIcon className="h-4 w-4" />
                    <span>{VIEW_TYPE_LABELS[type]} view</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Right-click context menu — positioned absolutely */}
      {contextMenuOpen && contextMenuPosition && contextMenuViewId && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 min-w-32 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
          style={{
            left: contextMenuPosition.x,
            top: contextMenuPosition.y,
          }}
        >
          <button
            type="button"
            onClick={() => handleContextMenuAction("rename")}
            className="flex w-full cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground"
          >
            <Pencil className="h-4 w-4" />
            <span>Rename</span>
          </button>
          <button
            type="button"
            onClick={() => handleContextMenuAction("duplicate")}
            className="flex w-full cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground"
          >
            <Copy className="h-4 w-4" />
            <span>Duplicate</span>
          </button>
          <div className="-mx-1 my-1 h-px bg-border" />
          {isLastView ? (
            <button
              type="button"
              disabled
              title="Cannot delete the last view"
              className="flex w-full cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none opacity-50 text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete view</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleContextMenuAction("delete")}
              className="flex w-full cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete view</span>
            </button>
          )}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={deleteViewId !== null}
        onOpenChange={(open) => {
          if (!open) cancelDelete();
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &ldquo;{deleteViewName}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDelete}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
