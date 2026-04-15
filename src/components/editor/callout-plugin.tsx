"use client";

import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getNodeByKey,
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
    // Register the CalloutNode if not already registered
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

  // Mutation listener to render emoji prefix in callout DOM
  useEffect(() => {
    return editor.registerMutationListener(CalloutNode, (mutations) => {
      for (const [nodeKey, mutation] of mutations) {
        if (mutation === "destroyed") continue;

        const dom = editor.getElementByKey(nodeKey);
        if (!dom) continue;

        editor.read(() => {
          const node = $getNodeByKey(nodeKey);
          if (!(node instanceof CalloutNode)) return;

          const emoji = node.getEmoji();

          // querySelector returns Element | null; safe to narrow because we create this span ourselves
          let emojiSpan = dom.querySelector(
            ".callout-emoji"
          ) as HTMLSpanElement | null;

          if (!emojiSpan) {
            emojiSpan = document.createElement("span");
            emojiSpan.className = "callout-emoji select-none text-lg shrink-0";
            emojiSpan.contentEditable = "false";
            dom.insertBefore(emojiSpan, dom.firstChild);
          }

          emojiSpan.textContent = emoji;
        });
      }
    });
  }, [editor]);

  return null;
}
