import { useCallback, useState } from "react";

/**
 * Roving tabindex for flat listbox/list widgets.
 *
 * Manages focusedId state, computes tabbableId, and provides an onKeyDown
 * handler that moves focus with ArrowUp/Down, Home/End, and activates with
 * Enter. The container should set `role="listbox"` and each item
 * `role="option"`.
 *
 * Items are identified by a `data-item-id` attribute on each focusable element.
 * The consumer must pass a `containerRef` so the hook can query for items.
 */
export function useRovingTabindex({
  itemIds,
  onActivate,
  containerRef,
}: {
  /** Ordered list of item IDs currently visible in the list. */
  itemIds: string[];
  /** Called when Enter is pressed on a focused item. */
  onActivate: (id: string) => void;
  /** Ref to the listbox container element. */
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [focusedId, setFocusedId] = useState<string | null>(null);

  // The item that should have tabIndex=0. Falls back to first item so the
  // widget is reachable via Tab.
  const tabbableId =
    focusedId && itemIds.includes(focusedId)
      ? focusedId
      : itemIds.length > 0
        ? itemIds[0]
        : null;

  const focusItem = useCallback(
    (id: string) => {
      setFocusedId(id);
      requestAnimationFrame(() => {
        const el = containerRef.current?.querySelector(
          `[data-item-id="${id}"]`,
        ) as HTMLElement | null;
        el?.focus();
      });
    },
    [containerRef],
  );

  const handleFocus = useCallback((e: React.FocusEvent) => {
    if (!(e.target instanceof HTMLElement)) return;
    const id = e.target.getAttribute("data-item-id");
    if (id) {
      setFocusedId(id);
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (itemIds.length === 0) return;

      const currentIdx = focusedId ? itemIds.indexOf(focusedId) : -1;

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const nextIdx =
            currentIdx < itemIds.length - 1 ? currentIdx + 1 : 0;
          focusItem(itemIds[nextIdx]);
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const prevIdx =
            currentIdx > 0 ? currentIdx - 1 : itemIds.length - 1;
          focusItem(itemIds[prevIdx]);
          break;
        }
        case "Home": {
          e.preventDefault();
          focusItem(itemIds[0]);
          break;
        }
        case "End": {
          e.preventDefault();
          focusItem(itemIds[itemIds.length - 1]);
          break;
        }
        case "Enter": {
          e.preventDefault();
          if (focusedId && itemIds.includes(focusedId)) {
            onActivate(focusedId);
          }
          break;
        }
        default:
          return;
      }
    },
    [itemIds, focusedId, focusItem, onActivate],
  );

  return {
    focusedId,
    tabbableId,
    handleFocus,
    handleKeyDown,
  };
}
