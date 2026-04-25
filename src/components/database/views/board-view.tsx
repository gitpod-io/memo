"use client";

import { memo, useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getPropertyTypeConfig } from "@/components/database/property-types/index";
import { evaluateFormulaForRow } from "@/components/database/property-types/formula";
import type {
  DatabaseProperty,
  DatabaseRow,
  DatabaseViewConfig,
} from "@/lib/types";
import {
  UNCATEGORIZED_COLUMN_ID,
  groupRowsIntoColumns,
  resolveDropOptionId,
  type ColumnData,
} from "./board-view-helpers";
import {
  useBoardKeyboardNavigation,
  type BoardFocusedCard,
} from "./board-keyboard";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface BoardViewProps {
  rows: DatabaseRow[];
  properties: DatabaseProperty[];
  viewConfig: DatabaseViewConfig;
  workspaceSlug: string;
  /** Called when a card is moved to a different column (select value changed). */
  onCardMove?: (rowId: string, propertyId: string, newOptionId: string | null) => void;
  /** Called when a new row should be added with a pre-filled select value. */
  onAddRow?: (initialValues?: Record<string, Record<string, unknown>>) => void;
  /** Called when keyboard Enter navigates to a card. Receives the URL path. */
  onNavigate?: (path: string) => void;
  /** Loading state — shows skeleton. */
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Drag state
// ---------------------------------------------------------------------------

interface DragState {
  rowId: string;
  sourceColumnId: string;
}

interface DropTarget {
  columnId: string;
  insertIndex: number;
}



// ---------------------------------------------------------------------------
// BoardView
// ---------------------------------------------------------------------------

export const BoardView = memo(function BoardView({
  rows,
  properties,
  viewConfig,
  workspaceSlug,
  onCardMove,
  onAddRow,
  onNavigate,
  loading = false,
}: BoardViewProps) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  // Resolve the group_by property
  const groupByPropertyId = viewConfig.group_by ?? null;
  const groupByProperty = useMemo(
    () => properties.find((p) => p.id === groupByPropertyId) ?? null,
    [properties, groupByPropertyId],
  );

  // Visible properties for card display (exclude the group_by property itself)
  const visibleProperties = useMemo(() => {
    const visibleSet = viewConfig.visible_properties
      ? new Set(viewConfig.visible_properties)
      : null;
    return properties.filter((p) => {
      if (p.id === groupByPropertyId) return false;
      if (visibleSet) return visibleSet.has(p.id);
      return true;
    });
  }, [properties, viewConfig.visible_properties, groupByPropertyId]);

  // Build columns from select/status options
  const columns = useMemo(() => {
    if (!groupByProperty || (groupByProperty.type !== "select" && groupByProperty.type !== "status")) return [];

    return groupRowsIntoColumns({
      groupByProperty,
      rows,
      hideEmptyGroups: viewConfig.hide_empty_groups ?? false,
    });
  }, [groupByProperty, rows, viewConfig.hide_empty_groups]);

  // --- Keyboard navigation ---

  const { focusedCard, containerRef, handleKeyDown, handleCardFocus } =
    useBoardKeyboardNavigation({ columns, workspaceSlug, onNavigate });

  // --- Drag handlers ---

  const handleDragStart = useCallback(
    (e: React.DragEvent, rowId: string, columnId: string) => {
      setDragState({ rowId, sourceColumnId: columnId });
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", rowId);
      // Set drag image opacity via the element
      if (e.currentTarget instanceof HTMLElement) {
        e.currentTarget.style.opacity = "0.5";
      }
    },
    [],
  );

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
    setDragState(null);
    setDropTarget(null);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, columnId: string, insertIndex: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropTarget({ columnId, insertIndex });
    },
    [],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if leaving the column entirely (not entering a child)
    const relatedTarget = e.relatedTarget;
    if (
      e.currentTarget instanceof HTMLElement &&
      relatedTarget instanceof Node &&
      e.currentTarget.contains(relatedTarget)
    ) {
      return;
    }
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, columnId: string) => {
      e.preventDefault();
      if (!dragState || !onCardMove || !groupByProperty) return;

      const newOptionId = resolveDropOptionId(columnId);
      onCardMove(dragState.rowId, groupByProperty.id, newOptionId);

      setDragState(null);
      setDropTarget(null);
    },
    [dragState, onCardMove, groupByProperty],
  );

  // --- Add card handler ---

  const handleAddCard = useCallback(
    (columnId: string) => {
      if (!onAddRow || !groupByProperty) return;
      if (columnId === UNCATEGORIZED_COLUMN_ID) {
        onAddRow();
      } else {
        onAddRow({ [groupByProperty.id]: { option_id: columnId } });
      }
    },
    [onAddRow, groupByProperty],
  );

  // --- Loading skeleton ---

  if (loading) {
    return <BoardSkeleton />;
  }

  // --- No group_by configured ---

  if (!groupByProperty || (groupByProperty.type !== "select" && groupByProperty.type !== "status")) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Select a &quot;Group by&quot; property (select or status type) to use board view
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex gap-3 overflow-x-auto pb-4"
      role="region"
      aria-label="Database board"
      data-testid="db-board-container"
      onKeyDown={handleKeyDown}
    >
      {columns.map((column, columnIndex) => (
        <BoardColumn
          key={column.id}
          column={column}
          columnIndex={columnIndex}
          visibleProperties={visibleProperties}
          allProperties={properties}
          workspaceSlug={workspaceSlug}
          dragState={dragState}
          dropTarget={dropTarget}
          focusedCard={focusedCard}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onAddCard={onAddRow ? handleAddCard : undefined}
          onCardFocus={handleCardFocus}
        />
      ))}
    </div>
  );
});

// ---------------------------------------------------------------------------
// BoardColumn
// ---------------------------------------------------------------------------

interface BoardColumnProps {
  column: ColumnData;
  columnIndex: number;
  visibleProperties: DatabaseProperty[];
  allProperties: DatabaseProperty[];
  workspaceSlug: string;
  dragState: DragState | null;
  dropTarget: DropTarget | null;
  focusedCard: BoardFocusedCard | null;
  onDragStart: (e: React.DragEvent, rowId: string, columnId: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent, columnId: string, insertIndex: number) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, columnId: string) => void;
  onAddCard?: (columnId: string) => void;
  onCardFocus: (columnIndex: number, cardIndex: number) => void;
}

const COLOR_DOT_STYLES: Record<string, string> = {
  gray: "bg-muted-foreground",
  blue: "bg-blue-400",
  green: "bg-green-400",
  yellow: "bg-yellow-400",
  orange: "bg-orange-400",
  red: "bg-red-400",
  purple: "bg-purple-400",
  pink: "bg-pink-400",
  cyan: "bg-cyan-400",
};

function BoardColumn({
  column,
  columnIndex,
  visibleProperties,
  allProperties,
  workspaceSlug,
  dragState,
  dropTarget,
  focusedCard,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onAddCard,
  onCardFocus,
}: BoardColumnProps) {
  const columnRef = useRef<HTMLDivElement>(null);

  const dotColor = COLOR_DOT_STYLES[column.color] ?? COLOR_DOT_STYLES.gray;

  const handleColumnDragOver = useCallback(
    (e: React.DragEvent) => {
      // Default to end of column when dragging over the column background
      onDragOver(e, column.id, column.rows.length);
    },
    [onDragOver, column.id, column.rows.length],
  );

  const handleColumnDrop = useCallback(
    (e: React.DragEvent) => {
      onDrop(e, column.id);
    },
    [onDrop, column.id],
  );

  const isDropTargetColumn = dropTarget?.columnId === column.id;

  return (
    <div
      ref={columnRef}
      className="w-72 shrink-0 bg-muted/50 p-2"
      role="group"
      aria-label={column.label}
      data-testid={`db-board-column-${column.id}`}
      data-column-label={column.label}
      onDragOver={handleColumnDragOver}
      onDragLeave={onDragLeave}
      onDrop={handleColumnDrop}
    >
      {/* Column header */}
      <div className="mb-2 flex items-center gap-1.5">
        <span className={cn("h-2 w-2 shrink-0", dotColor)} />
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {column.label}
        </span>
        <span className="text-xs text-muted-foreground/60">
          {column.rows.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col" role="list">
        {column.rows.map((row, index) => (
          <BoardCard
            key={row.page.id}
            row={row}
            columnId={column.id}
            columnIndex={columnIndex}
            index={index}
            visibleProperties={visibleProperties}
            allProperties={allProperties}
            workspaceSlug={workspaceSlug}
            isDragging={dragState?.rowId === row.page.id}
            isFocused={
              focusedCard?.columnIndex === columnIndex &&
              focusedCard?.cardIndex === index
            }
            showDropIndicatorBefore={
              isDropTargetColumn && dropTarget?.insertIndex === index
            }
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragOver={onDragOver}
            onCardFocus={onCardFocus}
          />
        ))}
        {/* Drop indicator at end of column */}
        {isDropTargetColumn &&
          dropTarget?.insertIndex === column.rows.length && (
            <div className="h-0.5 bg-accent" />
          )}
      </div>

      {/* Add card button */}
      {onAddCard && (
        <button
          type="button"
          onClick={() => onAddCard(column.id)}
          aria-label={`Add card to ${column.label}`}
          className="mt-1 w-full p-1.5 text-left text-xs text-muted-foreground hover:bg-overlay-hover"
        >
          + New
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BoardCard
// ---------------------------------------------------------------------------

interface BoardCardProps {
  row: DatabaseRow;
  columnId: string;
  columnIndex: number;
  index: number;
  visibleProperties: DatabaseProperty[];
  allProperties: DatabaseProperty[];
  workspaceSlug: string;
  isDragging: boolean;
  isFocused: boolean;
  showDropIndicatorBefore: boolean;
  onDragStart: (e: React.DragEvent, rowId: string, columnId: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent, columnId: string, insertIndex: number) => void;
  onCardFocus: (columnIndex: number, cardIndex: number) => void;
}

function BoardCard({
  row,
  columnId,
  columnIndex,
  index,
  visibleProperties,
  allProperties,
  workspaceSlug,
  isDragging,
  isFocused,
  showDropIndicatorBefore,
  onDragStart,
  onDragEnd,
  onDragOver,
  onCardFocus,
}: BoardCardProps) {
  const title = row.page.title || "Untitled";

  const handleCardDragOver = useCallback(
    (e: React.DragEvent) => {
      e.stopPropagation();
      onDragOver(e, columnId, index);
    },
    [onDragOver, columnId, index],
  );

  const handleFocus = useCallback(() => {
    onCardFocus(columnIndex, index);
  }, [onCardFocus, columnIndex, index]);

  return (
    <>
      {showDropIndicatorBefore && <div className="h-0.5 bg-accent" />}
      <Link
        href={`/${workspaceSlug}/${row.page.id}`}
        draggable
        tabIndex={0}
        role="listitem"
        aria-label={title}
        data-testid={`db-board-card-${row.page.id}`}
        data-board-col={columnIndex}
        data-board-row={index}
        onDragStart={(e) => onDragStart(e, row.page.id, columnId)}
        onDragEnd={onDragEnd}
        onDragOver={handleCardDragOver}
        onFocus={handleFocus}
        className={cn(
          "mb-1.5 block border border-overlay-border bg-muted p-3",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          isDragging && "opacity-50 shadow-lg",
          isFocused && "ring-2 ring-ring ring-offset-2",
        )}
      >
        {/* Card title */}
        <p className="line-clamp-2 text-sm font-medium">{title}</p>

        {/* Card properties */}
        {visibleProperties.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {visibleProperties.map((prop) => {
              if (prop.type === "formula") {
                const formulaValue = evaluateFormulaForRow(prop, row, allProperties);
                if (formulaValue._error || !formulaValue._display) return null;
                return (
                  <CardPropertyValue
                    key={prop.id}
                    property={prop}
                    value={formulaValue}
                  />
                );
              }
              const rv = row.values[prop.id];
              if (!rv) return null;
              return (
                <CardPropertyValue
                  key={prop.id}
                  property={prop}
                  value={rv.value}
                />
              );
            })}
          </div>
        )}
      </Link>
    </>
  );
}

// ---------------------------------------------------------------------------
// CardPropertyValue — renders a property value in compact card format
// ---------------------------------------------------------------------------

interface CardPropertyValueProps {
  property: DatabaseProperty;
  value: Record<string, unknown>;
}

function CardPropertyValue({ property, value }: CardPropertyValueProps) {
  const config = getPropertyTypeConfig(property.type);
  if (!config) return null;

  const { Renderer } = config;

  return (
    <span className="text-xs text-muted-foreground">
      <Renderer value={value} property={property} />
    </span>
  );
}

// ---------------------------------------------------------------------------
// BoardSkeleton
// ---------------------------------------------------------------------------

function BoardSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {Array.from({ length: 4 }).map((_, colIdx) => (
        <div key={colIdx} className="w-72 shrink-0 bg-muted/50 p-2">
          <div className="mb-2 flex items-center gap-1.5">
            <div className="h-2 w-2 animate-pulse bg-overlay-border" />
            <div className="h-3 w-16 animate-pulse bg-overlay-border" />
          </div>
          {Array.from({ length: colIdx === 0 ? 3 : colIdx === 1 ? 2 : 1 }).map(
            (_, cardIdx) => (
              <div
                key={cardIdx}
                className="mb-1.5 border border-overlay-border bg-muted p-3"
              >
                <div className="h-4 w-3/4 animate-pulse bg-overlay-border" />
                <div className="mt-1.5 h-3 w-1/2 animate-pulse bg-overlay-border" />
              </div>
            ),
          )}
        </div>
      ))}
    </div>
  );
}
