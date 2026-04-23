"use client";

import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import { createPortal } from "react-dom";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $deleteTableColumn__EXPERIMENTAL,
  $deleteTableRow__EXPERIMENTAL,
  $getTableCellNodeFromLexicalNode,
  $getTableNodeFromLexicalNodeOrThrow,
  $insertTableColumn__EXPERIMENTAL,
  $insertTableRow__EXPERIMENTAL,
  TableCellNode,
} from "@lexical/table";
import {
  $getSelection,
  $isRangeSelection,
  type LexicalEditor,
} from "lexical";
import {
  Trash2,
  MoreHorizontal,
  ArrowDown,
  ArrowRight,
} from "lucide-react";

function TableActionMenu({
  editor,
  tableCellNode,
  onClose,
  anchorPosition,
}: {
  editor: LexicalEditor;
  tableCellNode: TableCellNode;
  onClose: () => void;
  anchorPosition: { x: number; y: number };
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        event.target instanceof Node &&
        !menuRef.current.contains(event.target)
      ) {
        onClose();
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const insertRowAbove = useCallback(() => {
    editor.update(() => {
      $insertTableRow__EXPERIMENTAL(false);
    });
    onClose();
  }, [editor, onClose]);

  const insertRowBelow = useCallback(() => {
    editor.update(() => {
      $insertTableRow__EXPERIMENTAL(true);
    });
    onClose();
  }, [editor, onClose]);

  const insertColumnLeft = useCallback(() => {
    editor.update(() => {
      $insertTableColumn__EXPERIMENTAL(false);
    });
    onClose();
  }, [editor, onClose]);

  const insertColumnRight = useCallback(() => {
    editor.update(() => {
      $insertTableColumn__EXPERIMENTAL(true);
    });
    onClose();
  }, [editor, onClose]);

  const deleteRow = useCallback(() => {
    editor.update(() => {
      $deleteTableRow__EXPERIMENTAL();
    });
    onClose();
  }, [editor, onClose]);

  const deleteColumn = useCallback(() => {
    editor.update(() => {
      $deleteTableColumn__EXPERIMENTAL();
    });
    onClose();
  }, [editor, onClose]);

  const deleteTable = useCallback(() => {
    editor.update(() => {
      const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
      tableNode.remove();
    });
    onClose();
  }, [editor, tableCellNode, onClose]);

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-50 w-48 overflow-hidden rounded-sm border border-overlay-border bg-popover p-1 shadow-md"
      style={{ top: anchorPosition.y, left: anchorPosition.x }}
    >
      <button
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-overlay-hover hover:text-foreground"
        onClick={insertRowAbove}
      >
        <ArrowDown className="h-4 w-4 rotate-180" />
        Insert row above
      </button>
      <button
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-overlay-hover hover:text-foreground"
        onClick={insertRowBelow}
      >
        <ArrowDown className="h-4 w-4" />
        Insert row below
      </button>
      <button
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-overlay-hover hover:text-foreground"
        onClick={insertColumnLeft}
      >
        <ArrowRight className="h-4 w-4 rotate-180" />
        Insert column left
      </button>
      <button
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-overlay-hover hover:text-foreground"
        onClick={insertColumnRight}
      >
        <ArrowRight className="h-4 w-4" />
        Insert column right
      </button>
      <div className="my-1 border-t border-overlay-border" />
      <button
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm text-destructive hover:bg-overlay-hover"
        onClick={deleteRow}
      >
        <Trash2 className="h-4 w-4" />
        Delete row
      </button>
      <button
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm text-destructive hover:bg-overlay-hover"
        onClick={deleteColumn}
      >
        <Trash2 className="h-4 w-4" />
        Delete column
      </button>
      <button
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm text-destructive hover:bg-overlay-hover"
        onClick={deleteTable}
      >
        <Trash2 className="h-4 w-4" />
        Delete table
      </button>
    </div>,
    document.body
  );
}

/**
 * Renders the menu trigger as a fixed-position overlay portaled to
 * document.body instead of into the Lexical-managed cell DOM.
 * Portaling React content into Lexical DOM nodes causes removeChild
 * errors when Lexical reconciles the table (e.g. on Tab cell navigation).
 *
 * The trigger position is kept in sync with the active cell via
 * scroll/resize listeners so it doesn't drift when the page scrolls.
 */
export function TableActionMenuPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [tableCellNode, setTableCellNode] = useState<TableCellNode | null>(
    null
  );
  const [cellDom, setCellDom] = useState<HTMLElement | null>(null);
  const [menuPosition, setMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const handleClose = useCallback(() => {
    setMenuPosition(null);
  }, []);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) {
          setTableCellNode(null);
          setCellDom(null);
          return;
        }
        const anchor = selection.anchor.getNode();
        const cellNode = $getTableCellNodeFromLexicalNode(anchor);
        if (cellNode) {
          setTableCellNode(cellNode);
          const element = editor.getElementByKey(cellNode.getKey());
          setCellDom(element);
        } else {
          setTableCellNode(null);
          setCellDom(null);
        }
      });
    });
  }, [editor]);

  // Close the dropdown menu on scroll so it doesn't float detached
  useEffect(() => {
    if (!menuPosition) return;
    const handleScroll = () => setMenuPosition(null);
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [menuPosition]);

  const handleMenuOpen = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setMenuPosition({ x: event.clientX, y: event.clientY });
    },
    []
  );

  if (!tableCellNode || !cellDom) {
    return null;
  }

  return createPortal(
    <>
      <TableCellMenuTrigger
        onMenuOpen={handleMenuOpen}
        cellDom={cellDom}
      />
      {menuPosition && (
        <TableActionMenu
          editor={editor}
          tableCellNode={tableCellNode}
          onClose={handleClose}
          anchorPosition={menuPosition}
        />
      )}
    </>,
    document.body
  );
}

/**
 * Trigger button that tracks the active cell's position via
 * getBoundingClientRect in an effect, with scroll/resize listeners
 * to stay anchored when the viewport changes.
 */
function TableCellMenuTrigger({
  onMenuOpen,
  cellDom,
}: {
  onMenuOpen: (event: React.MouseEvent) => void;
  cellDom: HTMLElement;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = cellDom.getBoundingClientRect();
    button.style.top = `${rect.top + 2}px`;
    button.style.left = `${rect.right - 22}px`;
  }, [cellDom]);

  // Position on mount and whenever the cell element changes
  useEffect(() => {
    updatePosition();
  }, [updatePosition]);

  // Re-position on scroll and resize
  useEffect(() => {
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [updatePosition]);

  return (
    <button
      ref={buttonRef}
      className="fixed z-40 flex h-5 w-5 items-center justify-center text-muted-foreground opacity-60 hover:opacity-100 focus:opacity-100"
      onClick={onMenuOpen}
      aria-label="Table cell actions"
    >
      <MoreHorizontal className="h-3.5 w-3.5" />
    </button>
  );
}
