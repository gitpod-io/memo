"use client";

import type { JSX } from "react";
import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getNearestNodeFromDOMNode,
  $getNodeByKey,
  COMMAND_PRIORITY_HIGH,
  DRAGOVER_COMMAND,
  DROP_COMMAND,
  type LexicalEditor,
} from "lexical";
import { mergeRegister } from "@lexical/utils";
import { GripVertical } from "lucide-react";

const DRAG_DATA_FORMAT = "application/x-memo-drag-block";
const DRAGGABLE_BLOCK_MENU_CLASSNAME = "memo-draggable-block-menu";
const DROP_INDICATOR_CLASSNAME = "memo-drop-indicator";

// Distance from left edge of editor to show drag handle
const HANDLE_LEFT_OFFSET = -28;
// Vertical dead zone — mouse must be within this distance of a block to show handle
const HANDLE_DEAD_ZONE = 4;

function getBlockElement(
  anchorElem: HTMLElement,
  editor: LexicalEditor,
  event: MouseEvent
): HTMLElement | null {
  const editorBounds = anchorElem.getBoundingClientRect();
  const y = event.clientY;

  // Walk through top-level block elements in the editor
  let blockElem: HTMLElement | null = null;
  let minDistance = Infinity;

  const children = anchorElem.querySelectorAll(
    "[data-lexical-editor] > *"
  );

  // If no direct children found, try the contentEditable's children
  const contentEditable = anchorElem.querySelector(
    '[contenteditable="true"]'
  );
  const elements = children.length > 0 ? children : contentEditable?.children;

  if (!elements) return null;

  for (let i = 0; i < elements.length; i++) {
    const elem = elements[i] as HTMLElement;
    const rect = elem.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;
    const distance = Math.abs(y - centerY);

    if (distance < minDistance && y >= rect.top - HANDLE_DEAD_ZONE && y <= rect.bottom + HANDLE_DEAD_ZONE) {
      minDistance = distance;
      blockElem = elem;
    }
  }

  // Verify the mouse is within the editor bounds horizontally
  if (
    blockElem &&
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

  // Track the hovered block element for showing the drag handle
  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      const target = event.target as HTMLElement;
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

  const handleMouseLeave = useCallback(() => {
    if (menuRef.current && !isDraggingRef.current) {
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

  const handleDragStart = useCallback(
    (event: React.DragEvent) => {
      const target = targetBlockElemRef.current;
      if (!target) return;

      const dataTransfer = event.dataTransfer;
      if (!dataTransfer) return;

      isDraggingRef.current = true;

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

  // Register drag-over and drop commands on the Lexical editor
  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        DRAGOVER_COMMAND,
        (event: DragEvent) => {
          if (!event.dataTransfer?.types.includes(DRAG_DATA_FORMAT)) {
            return false;
          }

          event.preventDefault();

          const blockElem = getBlockElement(anchorElem, editor, event);
          if (!blockElem || !dropIndicatorRef.current) return true;

          const blockRect = blockElem.getBoundingClientRect();
          const isBelow = event.clientY > blockRect.top + blockRect.height / 2;

          setDropIndicatorPosition(
            dropIndicatorRef.current,
            blockElem,
            anchorElem,
            isBelow
          );

          event.dataTransfer.dropEffect = "move";
          return true;
        },
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(
        DROP_COMMAND,
        (event: DragEvent) => {
          if (!event.dataTransfer?.types.includes(DRAG_DATA_FORMAT)) {
            return false;
          }

          event.preventDefault();

          const nodeKey = event.dataTransfer.getData(DRAG_DATA_FORMAT);
          if (!nodeKey) return true;

          const blockElem = getBlockElement(anchorElem, editor, event);
          if (!blockElem) return true;

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
          return true;
        },
        COMMAND_PRIORITY_HIGH
      )
    );
  }, [anchorElem, editor]);

  return createPortal(
    <>
      {/* Drag handle */}
      <div
        ref={menuRef}
        className={`${DRAGGABLE_BLOCK_MENU_CLASSNAME} absolute z-10 cursor-grab opacity-0 active:cursor-grabbing`}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        aria-label="Drag to reorder block"
        role="button"
        tabIndex={0}
      >
        <GripVertical className="h-5 w-5 text-muted-foreground hover:text-foreground" />
      </div>
      {/* Drop indicator line */}
      <div
        ref={dropIndicatorRef}
        className={`${DROP_INDICATOR_CLASSNAME} pointer-events-none absolute z-10 h-0.5 bg-accent opacity-0 transition-opacity duration-100`}
      />
    </>,
    anchorElem
  );
}
