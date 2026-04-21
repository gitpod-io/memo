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
 * Explicitly yields to the TablePlugin's Tab handler (registered at
 * COMMAND_PRIORITY_CRITICAL) when the selection is inside a table cell.
 * Without this guard, $getNearestBlockElementAncestorOrThrow can throw
 * in edge cases within table cells, preventing the event from being
 * handled and causing the browser's default Tab behaviour to corrupt
 * the table DOM.
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

        // Let the TablePlugin handle Tab inside table cells.
        if ($findMatchingParent(anchor, $isTableCellNode) !== null) {
          return false;
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
