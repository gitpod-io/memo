"use client";

import { useEffect } from "react";
import {
  registerCodeHighlighting,
  $isCodeNode,
  $createCodeHighlightNode,
} from "@lexical/code";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $findMatchingParent, mergeRegister } from "@lexical/utils";
import {
  $createLineBreakNode,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  PASTE_COMMAND,
} from "lexical";

/**
 * Handles paste inside CodeNode by inserting line breaks instead of paragraphs.
 *
 * Lexical's default rich-text paste handler splits multi-line text into separate
 * paragraph nodes via `selection.insertParagraph()`. Inside a CodeNode this breaks
 * out of the code block, losing all lines after the first. This handler intercepts
 * paste at a higher priority and inserts CodeHighlightNode + LineBreakNode pairs
 * so all pasted lines stay inside the code block. The existing syntax-highlighting
 * transform (from `registerCodeHighlighting`) re-tokenizes automatically.
 */
function $handleCodeBlockPaste(event: ClipboardEvent): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) {
    return false;
  }

  const anchorNode = selection.anchor.getNode();
  const codeNode = $isCodeNode(anchorNode)
    ? anchorNode
    : $findMatchingParent(anchorNode, $isCodeNode);

  if (codeNode === null) {
    return false;
  }

  const clipboardData = event.clipboardData;
  if (clipboardData === null) {
    return false;
  }

  const text = clipboardData.getData("text/plain");
  if (!text) {
    return false;
  }

  event.preventDefault();

  // Remove any selected content first
  selection.removeText();

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) {
      // Insert a line break between lines (not a paragraph break)
      const lineBreak = $createLineBreakNode();
      selection.insertNodes([lineBreak]);
    }
    const line = lines[i];
    if (line.length > 0) {
      const textNode = $createCodeHighlightNode(line);
      selection.insertNodes([textNode]);
    }
  }

  return true;
}

export function CodeHighlightPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return mergeRegister(
      registerCodeHighlighting(editor),
      editor.registerCommand(
        PASTE_COMMAND,
        (event: ClipboardEvent) => $handleCodeBlockPaste(event),
        COMMAND_PRIORITY_HIGH
      )
    );
  }, [editor]);

  return null;
}
