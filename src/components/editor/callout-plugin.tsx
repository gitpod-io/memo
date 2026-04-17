"use client";

import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  createCommand,
  type LexicalCommand,
} from "lexical";
import {
  $createCalloutNode,
  CalloutNode,
  type CalloutVariant,
} from "@/components/editor/callout-node";

export interface InsertCalloutPayload {
  emoji?: string;
  variant?: CalloutVariant;
}

export const INSERT_CALLOUT_COMMAND: LexicalCommand<InsertCalloutPayload> =
  createCommand("INSERT_CALLOUT_COMMAND");

export function CalloutPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editor.hasNodes([CalloutNode])) {
      throw new Error(
        "CalloutPlugin: CalloutNode not registered on editor. Add it to initialConfig.nodes."
      );
    }

    return editor.registerCommand(
      INSERT_CALLOUT_COMMAND,
      (payload: InsertCalloutPayload) => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const calloutNode = $createCalloutNode(
            payload.emoji,
            payload.variant
          );
          $insertNodes([calloutNode]);
          calloutNode.selectEnd();
        }
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    );
  }, [editor]);

  return null;
}
