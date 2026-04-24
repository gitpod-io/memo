"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DatabaseProperty } from "@/lib/types";
import type {
  ColumnDragState,
  ColumnDropTarget,
} from "@/components/database/views/table-column-header";

// ---------------------------------------------------------------------------
// useColumnResize — manages column width state and mouse-drag resizing.
// ---------------------------------------------------------------------------

const DEFAULT_COLUMN_WIDTH = 180;
const MIN_COLUMN_WIDTH = 80;

interface UseColumnResizeParams {
  properties: DatabaseProperty[];
  initialWidths?: Record<string, number>;
  onColumnWidthsChange?: (widths: Record<string, number>) => void;
}

export function useColumnResize({
  properties,
  initialWidths,
  onColumnWidthsChange,
}: UseColumnResizeParams) {
  const propertyKey = properties.map((p) => p.id).join(",");
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => ({
    ...Object.fromEntries(properties.map((p) => [p.id, DEFAULT_COLUMN_WIDTH])),
    ...initialWidths,
  }));

  // Reset widths when property set changes
  const [prevPropertyKey, setPrevPropertyKey] = useState(propertyKey);
  if (propertyKey !== prevPropertyKey) {
    setPrevPropertyKey(propertyKey);
    const base: Record<string, number> = {};
    for (const p of properties) {
      base[p.id] = columnWidths[p.id] ?? DEFAULT_COLUMN_WIDTH;
    }
    setColumnWidths({ ...base, ...initialWidths });
  }

  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  const prevResizingColumn = useRef<string | null>(null);

  const handleResizeStart = useCallback(
    (propertyId: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setResizingColumn(propertyId);
      resizeStartX.current = e.clientX;
      resizeStartWidth.current = columnWidths[propertyId] ?? DEFAULT_COLUMN_WIDTH;
    },
    [columnWidths],
  );

  useEffect(() => {
    if (!resizingColumn) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartX.current;
      const newWidth = Math.max(MIN_COLUMN_WIDTH, resizeStartWidth.current + delta);
      setColumnWidths((prev) => ({ ...prev, [resizingColumn]: newWidth }));
    };

    const handleMouseUp = () => {
      setResizingColumn(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizingColumn, onColumnWidthsChange]);

  // Persist column widths after a resize ends
  useEffect(() => {
    if (prevResizingColumn.current !== null && resizingColumn === null) {
      onColumnWidthsChange?.(columnWidths);
    }
    prevResizingColumn.current = resizingColumn;
  }, [resizingColumn, columnWidths, onColumnWidthsChange]);

  return { columnWidths, resizingColumn, handleResizeStart };
}

// ---------------------------------------------------------------------------
// useColumnDragReorder — manages drag-and-drop column reordering state.
// ---------------------------------------------------------------------------

interface UseColumnDragReorderParams {
  visibleProperties: DatabaseProperty[];
  onColumnReorder?: (orderedPropertyIds: string[]) => void;
}

export function useColumnDragReorder({
  visibleProperties,
  onColumnReorder,
}: UseColumnDragReorderParams) {
  const [columnDrag, setColumnDrag] = useState<ColumnDragState | null>(null);
  const [columnDropTarget, setColumnDropTarget] = useState<ColumnDropTarget | null>(null);

  const handleColumnDragStart = useCallback(
    (e: React.DragEvent, propertyId: string) => {
      if (!onColumnReorder) return;
      setColumnDrag({ propertyId });
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", propertyId);
      if (e.currentTarget instanceof HTMLElement) {
        e.currentTarget.style.opacity = "0.5";
      }
    },
    [onColumnReorder],
  );

  const handleColumnDragEnd = useCallback((e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
    setColumnDrag(null);
    setColumnDropTarget(null);
  }, []);

  const handleColumnDragOver = useCallback(
    (e: React.DragEvent, colIndex: number) => {
      if (!columnDrag) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      const rect = e.currentTarget.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      const insertIndex = e.clientX < midX ? colIndex : colIndex + 1;

      setColumnDropTarget({ insertIndex });
    },
    [columnDrag],
  );

  const handleColumnDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!columnDrag || !columnDropTarget || !onColumnReorder) return;

      const draggedId = columnDrag.propertyId;
      const fromIndex = visibleProperties.findIndex((p) => p.id === draggedId);
      let toIndex = columnDropTarget.insertIndex;

      if (fromIndex < toIndex) {
        toIndex -= 1;
      }

      if (fromIndex !== -1 && toIndex !== fromIndex) {
        const newOrder = visibleProperties.map((p) => p.id);
        const [removed] = newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, removed);
        onColumnReorder(newOrder);
      }

      setColumnDrag(null);
      setColumnDropTarget(null);
    },
    [columnDrag, columnDropTarget, onColumnReorder, visibleProperties],
  );

  return {
    columnDrag,
    columnDropTarget,
    handleColumnDragStart,
    handleColumnDragEnd,
    handleColumnDragOver,
    handleColumnDrop,
  };
}
