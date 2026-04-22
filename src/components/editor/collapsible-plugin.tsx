"use client";

import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createParagraphNode,
  $createTextNode,
  $getNodeByKey,
  $getSelection,
  $insertNodes,
  $isParagraphNode,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_LOW,
  KEY_ENTER_COMMAND,
  createCommand,
  type LexicalCommand,
} from "lexical";
import {
  $createCollapsibleContainerNode,
  $createCollapsibleContentNode,
  $createCollapsibleTitleNode,
  $isCollapsibleContainerNode,
  $isCollapsibleContentNode,
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

    const unregisterInsert = editor.registerCommand(
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

    // When Enter is pressed on an empty last paragraph inside collapsible
    // content, escape the collapsible by moving the paragraph after the
    // container. This mirrors the behavior of lists and block quotes.
    const unregisterEnter = editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          return false;
        }

        const anchorNode = selection.anchor.getNode();
        const parentBlock =
          $isParagraphNode(anchorNode)
            ? anchorNode
            : anchorNode.getParent();

        if (
          !$isParagraphNode(parentBlock) ||
          parentBlock.getTextContentSize() !== 0
        ) {
          return false;
        }

        const contentNode = parentBlock.getParent();
        if (!$isCollapsibleContentNode(contentNode)) {
          return false;
        }

        // Only escape when the empty paragraph is the last child
        if (contentNode.getLastChild()?.getKey() !== parentBlock.getKey()) {
          return false;
        }

        const container = contentNode.getParent();
        if (!$isCollapsibleContainerNode(container)) {
          return false;
        }

        if (event) {
          event.preventDefault();
        }

        // Move the empty paragraph out of the collapsible
        parentBlock.remove();
        const newParagraph = $createParagraphNode();
        container.insertAfter(newParagraph);
        newParagraph.selectStart();

        return true;
      },
      COMMAND_PRIORITY_LOW
    );

    return () => {
      unregisterInsert();
      unregisterEnter();
    };
  }, [editor]);

  // Handle toggle open/close via the chevron button.
  // The native <summary> click toggles <details>, which conflicts with
  // Lexical text editing in the title. We prevent the native toggle on
  // summary clicks and instead toggle only when the chevron is clicked.
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

          const summary = dom.querySelector("summary");
          if (!summary) continue;

          const chevron = summary.querySelector(
            ".collapsible-toggle"
          ) as HTMLButtonElement | null;

          // Prevent the native <details> toggle when clicking the summary
          // text area — this allows Lexical to handle cursor placement
          // and text editing without the section collapsing.
          const handleSummaryClick = (e: MouseEvent) => {
            const target = e.target;
            // Allow the chevron button (and its SVG children) to toggle
            if (
              chevron &&
              target instanceof Node &&
              (chevron === target || chevron.contains(target))
            ) {
              return;
            }
            // Prevent native toggle for all other summary clicks (text editing)
            e.preventDefault();
          };

          // Toggle via the chevron button only
          const handleChevronClick = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            editor.update(() => {
              const node = $getNodeByKey(nodeKey);
              if (node instanceof CollapsibleContainerNode) {
                const newOpen = !node.getOpen();
                node.setOpen(newOpen);
                // Sync the DOM immediately since we prevented native toggle
                dom.open = newOpen;
              }
            });
          };

          summary.addEventListener("click", handleSummaryClick);
          if (chevron) {
            chevron.addEventListener("click", handleChevronClick);
          }

          cleanupMap.set(nodeKey, () => {
            summary.removeEventListener("click", handleSummaryClick);
            if (chevron) {
              chevron.removeEventListener("click", handleChevronClick);
            }
          });
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
