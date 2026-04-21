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
      className="fixed z-50 w-48 overflow-hidden rounded-sm border border-white/[0.06] bg-popover p-1 shadow-md"
      style={{ top: anchorPosition.y, left: anchorPosition.x }}
    >
      <button
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
        onClick={insertRowAbove}
      >
        <ArrowDown className="h-4 w-4 rotate-180" />
        Insert row above
      </button>
      <button
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
        onClick={insertRowBelow}
      >
        <ArrowDown className="h-4 w-4" />
        Insert row below
      </button>
      <button
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
        onClick={insertColumnLeft}
      >
        <ArrowRight className="h-4 w-4 rotate-180" />
        Insert column left
      </button>
      <button
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
        onClick={insertColumnRight}
      >
        <ArrowRight className="h-4 w-4" />
        Insert column right
      </button>
      <div className="my-1 border-t border-white/[0.06]" />
      <button
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm text-destructive hover:bg-white/[0.04]"
        onClick={deleteRow}
      >
        <Trash2 className="h-4 w-4" />
        Delete row
      </button>
      <button
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm text-destructive hover:bg-white/[0.04]"
        onClick={deleteColumn}
      >
        <Trash2 className="h-4 w-4" />
        Delete column
      </button>
      <button
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm text-destructive hover:bg-white/[0.04]"
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
 * Renders a trigger button overlaid on the active table cell. The button
 * is portalled to document.body and positioned with fixed layout using
 * the cell's bounding rect. This avoids inserting DOM nodes into
 * Lexical-managed elements, which causes React/Lexical reconciliation
 * conflicts (the root cause of the "Tab deletes table" bug — see #401).
 */
export function TableActionMenuPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [tableCellNode, setTableCellNode] = useState<TableCellNode | null>(
    null
  );
  const [menuPosition, setMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
  const [isCellHovered, setIsCellHovered] = useState(false);

  const handleClose = useCallback(() => {
    setTableCellNode(null);
    setMenuPosition(null);
  }, []);

  // Track the active cell and compute the trigger button position from
  // the cell's bounding rect rather than portalling into the cell DOM.
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) {
          setTableCellNode(null);
          setTriggerRect(null);
          return;
        }
        const anchor = selection.anchor.getNode();
        const cellNode = $getTableCellNodeFromLexicalNode(anchor);
        if (cellNode) {
          setTableCellNode(cellNode);
          // Defer DOM measurement to after React commit
          requestAnimationFrame(() => {
            const cellDom = editor.getElementByKey(cellNode.getKey());
            if (cellDom) {
              setTriggerRect(cellDom.getBoundingClientRect());
            }
          });
        } else {
          setTableCellNode(null);
          setTriggerRect(null);
        }
      });
    });
  }, [editor]);

  // Recompute trigger position on scroll/resize so it stays aligned
  useEffect(() => {
    if (!tableCellNode) return;

    const updatePosition = () => {
      const cellDom = editor.getElementByKey(tableCellNode.getKey());
      if (cellDom) {
        setTriggerRect(cellDom.getBoundingClientRect());
      }
    };

    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [editor, tableCellNode]);

  // Show the trigger button when hovering the active cell. Since the
  // button is portalled to document.body, CSS parent-hover selectors
  // can't reach it — use JS listeners on the cell DOM instead.
  useEffect(() => {
    if (!tableCellNode) return;

    const cellDom = editor.getElementByKey(tableCellNode.getKey());
    if (!cellDom) return;

    const onEnter = () => setIsCellHovered(true);
    const onLeave = () => setIsCellHovered(false);
    cellDom.addEventListener("mouseenter", onEnter);
    cellDom.addEventListener("mouseleave", onLeave);
    return () => {
      cellDom.removeEventListener("mouseenter", onEnter);
      cellDom.removeEventListener("mouseleave", onLeave);
      setIsCellHovered(false);
    };
  }, [editor, tableCellNode]);

  const handleMenuOpen = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setMenuPosition({ x: event.clientX, y: event.clientY });
    },
    []
  );

  if (!tableCellNode || !triggerRect) {
    return null;
  }

  return (
    <>
      {createPortal(
        <TableCellMenuTrigger
          onMenuOpen={handleMenuOpen}
          cellRect={triggerRect}
          isCellHovered={isCellHovered}
        />,
        document.body
      )}
      {menuPosition && (
        <TableActionMenu
          editor={editor}
          tableCellNode={tableCellNode}
          onClose={handleClose}
          anchorPosition={menuPosition}
        />
      )}
    </>
  );
}

function TableCellMenuTrigger({
  onMenuOpen,
  cellRect,
  isCellHovered,
}: {
  onMenuOpen: (event: React.MouseEvent) => void;
  cellRect: DOMRect;
  isCellHovered: boolean;
}) {
  return (
    <button
      className={`fixed z-40 flex h-5 w-5 items-center justify-center text-muted-foreground hover:opacity-100 focus:opacity-100 ${isCellHovered ? "opacity-60" : "opacity-0"}`}
      style={{
        top: cellRect.top + 2,
        left: cellRect.right - 22,
      }}
      onClick={onMenuOpen}
      aria-label="Table cell actions"
      onMouseDown={(e) => e.preventDefault()}
    >
      <MoreHorizontal className="h-3.5 w-3.5" />
    </button>
  );
}
