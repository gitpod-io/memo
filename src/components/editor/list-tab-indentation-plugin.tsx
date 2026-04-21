"use client";

import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $isListItemNode } from "@lexical/list";
import {
  $findMatchingParent,
  $getNearestBlockElementAncestorOrThrow,
} from "@lexical/utils";
import { $isTableCellNode } from "@lexical/table";
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  INDENT_CONTENT_COMMAND,
  KEY_TAB_COMMAND,
  OUTDENT_CONTENT_COMMAND,
} from "lexical";

const MAX_LIST_INDENT = 7;

/**
 * Handles Tab/Shift+Tab for list item indentation. Lexical's built-in
 * TabIndentationPlugin only indents when the cursor is at block start
 * or the node reports canIndent()=true. ListItemNode returns false for
 * canIndent(), so Tab in the middle/end of a list item inserts a tab
 * character instead of nesting. This plugin intercepts Tab at a higher
 * priority and dispatches INDENT/OUTDENT commands when inside a list item.
 *
 * When the selection is inside a table cell, this plugin yields to the
 * TablePlugin's Tab handler (registered at COMMAND_PRIORITY_CRITICAL).
 * If the table handler did not handle the event (e.g. non-collapsed
 * selection), we still preventDefault to stop the browser from moving
 * focus out of the editor, which can corrupt the table DOM.
 */
export function ListTabIndentationPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_TAB_COMMAND,
      (event) => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) {
          return false;
        }

        const anchor = selection.anchor.getNode();

        // If the selection is inside a table cell, prevent the browser
        // default (which moves focus and can corrupt the table DOM).
        // The TablePlugin's CRITICAL-priority handler runs first and
        // handles cell navigation for collapsed selections. This guard
        // catches the remaining cases (e.g. non-collapsed selection).
        const tableCell = $findMatchingParent(anchor, $isTableCellNode);
        if (tableCell !== null) {
          event.preventDefault();
          return true;
        }

        const block = $getNearestBlockElementAncestorOrThrow(anchor);

        if (!$isListItemNode(block)) {
          return false;
        }

        event.preventDefault();

        editor.update(() => {
          if (event.shiftKey) {
            editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined);
          } else {
            if (block.getIndent() + 1 < MAX_LIST_INDENT) {
              editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined);
            }
          }
        });

        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor]);

  return null;
}
