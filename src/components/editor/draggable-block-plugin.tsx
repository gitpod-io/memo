"use client";

import type { JSX } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getNearestNodeFromDOMNode,
  $getNodeByKey,
  type LexicalEditor,
} from "lexical";
import { GripVertical } from "lucide-react";
import { TurnIntoMenu } from "@/components/editor/turn-into-menu";

const DRAG_DATA_FORMAT = "application/x-memo-drag-block";
const DRAGGABLE_BLOCK_MENU_CLASSNAME = "memo-draggable-block-menu";
const DROP_INDICATOR_CLASSNAME = "memo-drop-indicator";

// Position drag handle within the anchor's left padding (anchor has pl-8 = 32px)
const HANDLE_LEFT_OFFSET = 0;
// Vertical dead zone — mouse must be within this distance of a block to show handle
const HANDLE_DEAD_ZONE = 16;

function getTopLevelBlockElements(
  anchorElem: HTMLElement
): HTMLCollectionOf<Element> | NodeListOf<Element> | undefined {
  const children = anchorElem.querySelectorAll(
    "[data-lexical-editor] > *"
  );
  if (children.length > 0) return children;

  const contentEditable = anchorElem.querySelector(
    '[contenteditable="true"]'
  );
  return contentEditable?.children;
}

function getBlockElement(
  anchorElem: HTMLElement,
  editor: LexicalEditor,
  event: MouseEvent,
  /** When true (during drag), always return the nearest block regardless of dead zone */
  useUnboundedSearch = false
): HTMLElement | null {
  const editorBounds = anchorElem.getBoundingClientRect();
  const y = event.clientY;

  const elements = getTopLevelBlockElements(anchorElem);
  if (!elements) return null;

  // First pass: find the closest block within the dead zone
  let blockElem: HTMLElement | null = null;
  let minDistance = Infinity;

  for (let i = 0; i < elements.length; i++) {
    const elem = elements[i] as HTMLElement;
    const rect = elem.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;
    const distance = Math.abs(y - centerY);

    if (
      distance < minDistance &&
      y >= rect.top - HANDLE_DEAD_ZONE &&
      y <= rect.bottom + HANDLE_DEAD_ZONE
    ) {
      minDistance = distance;
      blockElem = elem;
    }
  }

  // Fallback: if nothing matched within the dead zone (cursor is in a gap
  // between blocks or beyond the last block), find the absolute nearest block.
  // Always used during drag; for hover, only when cursor is within the editor
  // vertical bounds.
  if (!blockElem) {
    const withinEditorY =
      y >= editorBounds.top && y <= editorBounds.bottom;

    if (useUnboundedSearch || withinEditorY) {
      let fallbackDistance = Infinity;
      for (let i = 0; i < elements.length; i++) {
        const elem = elements[i] as HTMLElement;
        const rect = elem.getBoundingClientRect();
        // Distance to the nearest edge of the element
        const dist =
          y < rect.top
            ? rect.top - y
            : y > rect.bottom
              ? y - rect.bottom
              : 0;
        if (dist < fallbackDistance) {
          fallbackDistance = dist;
          blockElem = elem;
        }
      }
    }
  }

  // For hover (non-drag), verify the mouse is within the editor bounds
  // horizontally. During drag the cursor may be over the handle/padding area
  // to the left of the editor — that's valid.
  if (
    blockElem &&
    !useUnboundedSearch &&
    (event.clientX < editorBounds.left - 50 ||
      event.clientX > editorBounds.right + 50)
  ) {
    return null;
  }

  return blockElem;
}

function isOnMenu(element: HTMLElement): boolean {
  return !!element.closest(`.${DRAGGABLE_BLOCK_MENU_CLASSNAME}`);
}

function setMenuPosition(
  menuRef: HTMLElement,
  targetElem: HTMLElement,
  anchorElem: HTMLElement
): void {
  const targetRect = targetElem.getBoundingClientRect();
  const anchorRect = anchorElem.getBoundingClientRect();

  menuRef.style.top = `${targetRect.top - anchorRect.top + targetRect.height / 2 - 12}px`;
  menuRef.style.left = `${HANDLE_LEFT_OFFSET}px`;
  menuRef.style.opacity = "1";
}

function setDropIndicatorPosition(
  indicator: HTMLElement,
  targetElem: HTMLElement,
  anchorElem: HTMLElement,
  isBelow: boolean
): void {
  const targetRect = targetElem.getBoundingClientRect();
  const anchorRect = anchorElem.getBoundingClientRect();

  const top = isBelow
    ? targetRect.bottom - anchorRect.top
    : targetRect.top - anchorRect.top;

  indicator.style.top = `${top}px`;
  indicator.style.left = "0";
  indicator.style.width = `${anchorRect.width}px`;
  indicator.style.opacity = "1";
}

interface DraggableBlockPluginProps {
  anchorElem: HTMLElement;
}

export function DraggableBlockPlugin({
  anchorElem,
}: DraggableBlockPluginProps): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const menuRef = useRef<HTMLDivElement>(null);
  const dropIndicatorRef = useRef<HTMLDivElement>(null);
  const draggingBlockElemRef = useRef<HTMLElement | null>(null);
  const targetBlockElemRef = useRef<HTMLElement | null>(null);
  const isDraggingRef = useRef(false);
  const [showTurnIntoMenu, setShowTurnIntoMenu] = useState(false);
  const turnIntoMenuRef = useRef<HTMLDivElement>(null);

  // Track the hovered block element for showing the drag handle
  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (isOnMenu(target) || isDraggingRef.current) return;

      const blockElem = getBlockElement(anchorElem, editor, event);
      if (blockElem && menuRef.current) {
        setMenuPosition(menuRef.current, blockElem, anchorElem);
        targetBlockElemRef.current = blockElem;
      } else if (menuRef.current) {
        menuRef.current.style.opacity = "0";
        targetBlockElemRef.current = null;
      }
    },
    [anchorElem, editor]
  );

  const handleMouseLeave = useCallback((event: MouseEvent) => {
    if (menuRef.current && !isDraggingRef.current) {
      // Don't hide if the mouse moved to the drag handle itself
      const relatedTarget = event.relatedTarget;
      if (relatedTarget instanceof HTMLElement && isOnMenu(relatedTarget))
        return;

      menuRef.current.style.opacity = "0";
      targetBlockElemRef.current = null;
    }
  }, []);

  useEffect(() => {
    anchorElem.addEventListener("mousemove", handleMouseMove);
    anchorElem.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      anchorElem.removeEventListener("mousemove", handleMouseMove);
      anchorElem.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [anchorElem, handleMouseMove, handleMouseLeave]);

  const handleMenuMouseLeave = useCallback(
    (event: React.MouseEvent) => {
      if (isDraggingRef.current) return;
      // Don't hide if the mouse moved back into the anchor element
      // relatedTarget can be a non-Node EventTarget (e.g. cross-origin iframe)
      const relatedTarget = event.relatedTarget;
      if (relatedTarget instanceof Node && anchorElem.contains(relatedTarget))
        return;

      if (menuRef.current) {
        menuRef.current.style.opacity = "0";
        targetBlockElemRef.current = null;
      }
    },
    [anchorElem]
  );

  const handleDragStart = useCallback(
    (event: React.DragEvent) => {
      const target = targetBlockElemRef.current;
      if (!target) return;

      const dataTransfer = event.dataTransfer;
      if (!dataTransfer) return;

      isDraggingRef.current = true;
      setShowTurnIntoMenu(false);

      // Find the Lexical node key for this DOM element
      let nodeKey: string | null = null;
      editor.read(() => {
        const node = $getNearestNodeFromDOMNode(target);
        if (node) {
          nodeKey = node.getKey();
        }
      });

      if (!nodeKey) return;

      dataTransfer.setData(DRAG_DATA_FORMAT, nodeKey);
      dataTransfer.effectAllowed = "move";

      // Set drag image
      const dragImage = target.cloneNode(true) as HTMLElement;
      dragImage.style.opacity = "0.5";
      dragImage.style.transform = "scale(1.02)";
      dragImage.style.boxShadow =
        "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)";
      dragImage.style.position = "absolute";
      dragImage.style.top = "-1000px";
      document.body.appendChild(dragImage);
      dataTransfer.setDragImage(dragImage, 0, 0);
      setTimeout(() => document.body.removeChild(dragImage), 0);

      draggingBlockElemRef.current = target;
      target.style.opacity = "0.5";
      target.style.transform = "scale(1.02)";
      target.style.boxShadow =
        "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)";
    },
    [editor]
  );

  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false;
    if (draggingBlockElemRef.current) {
      draggingBlockElemRef.current.style.opacity = "1";
      draggingBlockElemRef.current.style.transform = "";
      draggingBlockElemRef.current.style.boxShadow = "";
      draggingBlockElemRef.current = null;
    }
    if (dropIndicatorRef.current) {
      dropIndicatorRef.current.style.opacity = "0";
    }
  }, []);

  // Listen for dragover/drop on the anchorElem (the full-width container
  // including the left padding where the drag handle lives). Lexical's
  // DRAGOVER_COMMAND / DROP_COMMAND only fire on the contentEditable, so
  // dragging straight down from the handle would miss the editor entirely.
  const handleDragOver = useCallback(
    (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes(DRAG_DATA_FORMAT)) return;

      event.preventDefault();
      event.dataTransfer.dropEffect = "move";

      const blockElem = getBlockElement(anchorElem, editor, event, true);
      if (!blockElem || !dropIndicatorRef.current) return;

      const blockRect = blockElem.getBoundingClientRect();
      const isBelow = event.clientY > blockRect.top + blockRect.height / 2;

      setDropIndicatorPosition(
        dropIndicatorRef.current,
        blockElem,
        anchorElem,
        isBelow
      );
    },
    [anchorElem, editor]
  );

  const handleDrop = useCallback(
    (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes(DRAG_DATA_FORMAT)) return;

      event.preventDefault();

      const nodeKey = event.dataTransfer.getData(DRAG_DATA_FORMAT);
      if (!nodeKey) return;

      const blockElem = getBlockElement(anchorElem, editor, event, true);
      if (!blockElem) return;

      const blockRect = blockElem.getBoundingClientRect();
      const isBelow = event.clientY > blockRect.top + blockRect.height / 2;

      editor.update(() => {
        const draggedNode = $getNodeByKey(nodeKey);
        if (!draggedNode) return;

        const targetNode = $getNearestNodeFromDOMNode(blockElem);
        if (!targetNode) return;

        // Don't drop on self
        if (draggedNode.getKey() === targetNode.getKey()) return;

        // Remove from current position
        draggedNode.remove();

        // Insert at new position
        if (isBelow) {
          targetNode.insertAfter(draggedNode);
        } else {
          targetNode.insertBefore(draggedNode);
        }
      });

      if (dropIndicatorRef.current) {
        dropIndicatorRef.current.style.opacity = "0";
      }

      isDraggingRef.current = false;
    },
    [anchorElem, editor]
  );

  // Click on the drag handle opens the "Turn into" menu after selecting the block
  const handleHandleClick = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const target = targetBlockElemRef.current;
      if (!target) return;

      // Place the cursor inside the target block so the Turn Into plugin
      // knows which block to transform.
      editor.update(() => {
        const node = $getNearestNodeFromDOMNode(target);
        if (node) {
          node.selectStart();
        }
      });

      setShowTurnIntoMenu((prev) => !prev);
    },
    [editor],
  );

  const handleCloseTurnIntoMenu = useCallback(() => {
    setShowTurnIntoMenu(false);
  }, []);

  // Close the Turn Into menu when clicking outside
  useEffect(() => {
    if (!showTurnIntoMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (
        turnIntoMenuRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setShowTurnIntoMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showTurnIntoMenu]);

  useEffect(() => {
    anchorElem.addEventListener("dragover", handleDragOver);
    anchorElem.addEventListener("drop", handleDrop);
    return () => {
      anchorElem.removeEventListener("dragover", handleDragOver);
      anchorElem.removeEventListener("drop", handleDrop);
    };
  }, [anchorElem, handleDragOver, handleDrop]);

  return createPortal(
    <>
      {/* Drag handle */}
      <div
        ref={menuRef}
        className={`${DRAGGABLE_BLOCK_MENU_CLASSNAME} absolute z-10 cursor-grab opacity-0 active:cursor-grabbing`}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onMouseLeave={handleMenuMouseLeave}
        onClick={handleHandleClick}
        aria-label="Drag to reorder block, click for block menu"
        role="button"
        tabIndex={0}
      >
        <GripVertical className="h-5 w-5 text-muted-foreground hover:text-foreground" />
      </div>
      {/* Turn Into menu (shown on click) */}
      {showTurnIntoMenu && menuRef.current && (
        <div
          ref={turnIntoMenuRef}
          className="absolute z-50"
          style={{
            top: menuRef.current.style.top,
            left: "24px",
          }}
        >
          <TurnIntoMenu onClose={handleCloseTurnIntoMenu} />
        </div>
      )}
      {/* Drop indicator line */}
      <div
        ref={dropIndicatorRef}
        className={`${DROP_INDICATOR_CLASSNAME} pointer-events-none absolute z-10 h-0.5 bg-accent opacity-0 transition-opacity duration-100`}
      />
    </>,
    anchorElem
  );
}
