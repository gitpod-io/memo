"use client";

import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createParagraphNode,
  $createTextNode,
  $getNodeByKey,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  createCommand,
  type LexicalCommand,
} from "lexical";
import {
  $createCollapsibleContainerNode,
  $createCollapsibleContentNode,
  $createCollapsibleTitleNode,
  CollapsibleContainerNode,
  CollapsibleContentNode,
  CollapsibleTitleNode,
} from "@/components/editor/collapsible-node";

export const INSERT_COLLAPSIBLE_COMMAND: LexicalCommand<void> = createCommand(
  "INSERT_COLLAPSIBLE_COMMAND"
);

export function CollapsiblePlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (
      !editor.hasNodes([
        CollapsibleContainerNode,
        CollapsibleTitleNode,
        CollapsibleContentNode,
      ])
    ) {
      throw new Error(
        "CollapsiblePlugin: CollapsibleContainerNode, CollapsibleTitleNode, or CollapsibleContentNode not registered."
      );
    }

    return editor.registerCommand(
      INSERT_COLLAPSIBLE_COMMAND,
      () => {
        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;

          const title = $createCollapsibleTitleNode();
          title.append($createTextNode("Toggle title"));

          const contentParagraph = $createParagraphNode();
          contentParagraph.append($createTextNode("Toggle content"));

          const content = $createCollapsibleContentNode();
          content.append(contentParagraph);

          const container = $createCollapsibleContainerNode(true);
          container.append(title);
          container.append(content);

          $insertNodes([container]);

          // Add a paragraph after so the user can continue typing
          const afterParagraph = $createParagraphNode();
          container.insertAfter(afterParagraph);

          // Select the title text for immediate editing
          title.selectStart();
        });
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    );
  }, [editor]);

  // Handle toggle open/close via DOM events on <details>
  useEffect(() => {
    const cleanupMap = new Map<string, () => void>();

    const unregister = editor.registerMutationListener(
      CollapsibleContainerNode,
      (mutations) => {
        for (const [nodeKey, mutation] of mutations) {
          if (mutation === "destroyed") {
            const cleanup = cleanupMap.get(nodeKey);
            if (cleanup) {
              cleanup();
              cleanupMap.delete(nodeKey);
            }
            continue;
          }

          // Skip if already listening
          if (cleanupMap.has(nodeKey)) continue;

          const dom = editor.getElementByKey(
            nodeKey
          ) as HTMLDetailsElement | null;
          if (!dom) continue;

          const handleToggle = () => {
            editor.update(() => {
              const node = $getNodeByKey(nodeKey);
              if (node instanceof CollapsibleContainerNode) {
                node.setOpen(dom.open);
              }
            });
          };

          dom.addEventListener("toggle", handleToggle);
          cleanupMap.set(nodeKey, () =>
            dom.removeEventListener("toggle", handleToggle)
          );
        }
      }
    );

    return () => {
      unregister();
      cleanupMap.forEach((cleanup) => cleanup());
      cleanupMap.clear();
    };
  }, [editor]);

  return null;
}
