"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { GripVertical, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { PROPERTY_TYPE_ICON } from "@/lib/property-icons";
import type { DatabaseProperty } from "@/lib/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PropertyVisibilityPanelProps {
  properties: DatabaseProperty[];
  visiblePropertyIds: string[] | undefined;
  onVisibilityChange: (visibleIds: string[]) => void;
}

// ---------------------------------------------------------------------------
// PropertyVisibilityPanel
// ---------------------------------------------------------------------------

export function PropertyVisibilityPanel({
  properties,
  visiblePropertyIds,
  onVisibilityChange,
}: PropertyVisibilityPanelProps) {
  // Title property (position 0) is always visible and cannot be toggled
  const titleProperty = properties.find((p) => p.position === 0);
  const nonTitleProperties = properties.filter((p) => p.position !== 0);

  // Determine the ordered list of properties for the panel.
  // If visiblePropertyIds is set, use that order for visible ones, then append hidden ones.
  // Otherwise, use the natural property order.
  const orderedNonTitle = getOrderedProperties(
    nonTitleProperties,
    visiblePropertyIds,
  );

  // Compute which property IDs are currently visible
  const visibleSet = useMemo(
    () =>
      new Set(
        visiblePropertyIds && visiblePropertyIds.length > 0
          ? visiblePropertyIds
          : nonTitleProperties.map((p) => p.id),
      ),
    [visiblePropertyIds, nonTitleProperties],
  );

  const handleToggle = useCallback(
    (propertyId: string, checked: boolean) => {
      let newVisible: string[];
      if (checked) {
        // Add to visible list — append at end of current visible order
        const currentVisible = visiblePropertyIds ?? nonTitleProperties.map((p) => p.id);
        newVisible = [...currentVisible.filter((id) => id !== propertyId), propertyId];
      } else {
        // Remove from visible list
        const currentVisible = visiblePropertyIds ?? nonTitleProperties.map((p) => p.id);
        newVisible = currentVisible.filter((id) => id !== propertyId);
      }
      onVisibilityChange(newVisible);
    },
    [visiblePropertyIds, nonTitleProperties, onVisibilityChange],
  );

  // Drag-and-drop reorder state
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragCounterRef = useRef(0);

  const handleDragStart = useCallback(
    (e: React.DragEvent, propertyId: string) => {
      setDragId(propertyId);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", propertyId);
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
    setDragId(null);
    setDropIndex(null);
    dragCounterRef.current = 0;
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      if (!dragId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      const rect = e.currentTarget.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const insertIndex = e.clientY < midY ? index : index + 1;
      setDropIndex(insertIndex);
    },
    [dragId],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!dragId || dropIndex === null) return;

      const fromIndex = orderedNonTitle.findIndex((p) => p.id === dragId);
      let toIndex = dropIndex;
      if (fromIndex < toIndex) {
        toIndex -= 1;
      }

      if (fromIndex !== -1 && toIndex !== fromIndex) {
        const newOrder = orderedNonTitle.map((p) => p.id);
        const [removed] = newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, removed);
        // Update visible_properties to reflect new order (only visible ones)
        const newVisible = newOrder.filter((id) => visibleSet.has(id));
        onVisibilityChange(newVisible);
      }

      setDragId(null);
      setDropIndex(null);
      dragCounterRef.current = 0;
    },
    [dragId, dropIndex, orderedNonTitle, visibleSet, onVisibilityChange],
  );

  const activeCount = visibleSet.size;
  const totalCount = nonTitleProperties.length;

  return (
    <Popover>
      <PopoverTrigger
        className="inline-flex h-7 items-center gap-1 rounded-sm px-2 text-xs text-muted-foreground outline-none transition-colors hover:bg-overlay-hover hover:text-foreground"
        data-testid="property-visibility-trigger"
      >
        <SlidersHorizontal className="size-3" />
        Properties
        {activeCount < totalCount && (
          <span className="text-xs text-muted-foreground">
            ({activeCount})
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 p-0"
        data-testid="property-visibility-panel"
      >
        <div className="border-b border-overlay-border px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">
            Properties
          </span>
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {/* Title property — always visible, not draggable */}
          {titleProperty && (
            <PropertyRow
              property={titleProperty}
              visible={true}
              disabled={true}
              draggable={false}
            />
          )}

          {/* Non-title properties — toggleable and draggable */}
          {orderedNonTitle.map((prop, index) => {
            const isVisible = visibleSet.has(prop.id);
            const isDragging = dragId === prop.id;
            const showDropBefore =
              dragId !== null &&
              dropIndex === index &&
              dragId !== prop.id;
            const showDropAfter =
              dragId !== null &&
              dropIndex === index + 1 &&
              dragId !== prop.id;

            return (
              <PropertyRow
                key={prop.id}
                property={prop}
                visible={isVisible}
                disabled={false}
                draggable={true}
                isDragging={isDragging}
                showDropBefore={showDropBefore}
                showDropAfter={showDropAfter}
                onToggle={(checked) => handleToggle(prop.id, checked)}
                onDragStart={(e) => handleDragStart(e, prop.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={handleDrop}
              />
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// PropertyRow — single row in the panel
// ---------------------------------------------------------------------------

interface PropertyRowProps {
  property: DatabaseProperty;
  visible: boolean;
  disabled: boolean;
  draggable: boolean;
  isDragging?: boolean;
  showDropBefore?: boolean;
  showDropAfter?: boolean;
  onToggle?: (checked: boolean) => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

function PropertyRow({
  property,
  visible,
  disabled,
  draggable: isDraggable,
  isDragging = false,
  showDropBefore = false,
  showDropAfter = false,
  onToggle,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: PropertyRowProps) {
  const Icon = PROPERTY_TYPE_ICON[property.type];

  return (
    <div
      className={cn(
        "relative flex items-center gap-2 px-3 py-1.5",
        isDragging && "opacity-50",
        isDraggable && "cursor-grab",
      )}
      draggable={isDraggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      data-testid={`property-row-${property.id}`}
    >
      {showDropBefore && (
        <div className="absolute left-0 right-0 top-0 z-20 h-0.5 bg-accent" />
      )}

      {isDraggable ? (
        <GripVertical className="size-3 shrink-0 text-muted-foreground" />
      ) : (
        <span className="size-3 shrink-0" />
      )}

      <Icon className="size-3.5 shrink-0 text-muted-foreground" />

      <span className="min-w-0 flex-1 truncate text-sm">
        {property.name}
      </span>

      <Switch
        size="sm"
        checked={visible}
        disabled={disabled}
        onCheckedChange={(checked) => onToggle?.(checked)}
        aria-label={`Toggle ${property.name} visibility`}
        data-testid={`property-toggle-${property.id}`}
      />

      {showDropAfter && (
        <div className="absolute bottom-0 left-0 right-0 z-20 h-0.5 bg-accent" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Orders non-title properties: visible ones first (in visible_properties order),
 * then hidden ones (in their natural position order).
 */
function getOrderedProperties(
  nonTitleProperties: DatabaseProperty[],
  visiblePropertyIds: string[] | undefined,
): DatabaseProperty[] {
  if (!visiblePropertyIds || visiblePropertyIds.length === 0) {
    return nonTitleProperties;
  }

  const propMap = new Map(nonTitleProperties.map((p) => [p.id, p]));
  const ordered: DatabaseProperty[] = [];
  const seen = new Set<string>();

  // Visible properties in their configured order
  for (const id of visiblePropertyIds) {
    const prop = propMap.get(id);
    if (prop) {
      ordered.push(prop);
      seen.add(id);
    }
  }

  // Hidden properties in their natural position order
  const hidden = nonTitleProperties
    .filter((p) => !seen.has(p.id))
    .sort((a, b) => a.position - b.position);
  ordered.push(...hidden);

  return ordered;
}
