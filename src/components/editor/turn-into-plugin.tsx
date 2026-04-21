"use client";

import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  $isElementNode,
  COMMAND_PRIORITY_EDITOR,
  createCommand,
  type LexicalCommand,
  type LexicalNode,
  type ElementNode,
} from "lexical";
import { $setBlocksType } from "@lexical/selection";
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  $isQuoteNode,
  type HeadingTagType,
} from "@lexical/rich-text";
import { $createCodeNode, $isCodeNode } from "@lexical/code";
import {
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_CHECK_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
} from "@lexical/list";
import {
  $createCalloutNode,
  $isCalloutNode,
} from "@/components/editor/callout-node";
import type { ReactElement } from "react";
import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Code,
  Quote,
  MessageSquare,
} from "lucide-react";

export type BlockType =
  | "paragraph"
  | "h1"
  | "h2"
  | "h3"
  | "bullet"
  | "number"
  | "check"
  | "quote"
  | "code"
  | "callout";

export interface TurnIntoOption {
  type: BlockType;
  label: string;
  icon: ReactElement;
}

export const TURN_INTO_OPTIONS: TurnIntoOption[] = [
  { type: "paragraph", label: "Paragraph", icon: <Type className="h-4 w-4" /> },
  { type: "h1", label: "Heading 1", icon: <Heading1 className="h-4 w-4" /> },
  { type: "h2", label: "Heading 2", icon: <Heading2 className="h-4 w-4" /> },
  { type: "h3", label: "Heading 3", icon: <Heading3 className="h-4 w-4" /> },
  { type: "bullet", label: "Bullet List", icon: <List className="h-4 w-4" /> },
  { type: "number", label: "Numbered List", icon: <ListOrdered className="h-4 w-4" /> },
  { type: "check", label: "To-do List", icon: <CheckSquare className="h-4 w-4" /> },
  { type: "quote", label: "Quote", icon: <Quote className="h-4 w-4" /> },
  { type: "code", label: "Code Block", icon: <Code className="h-4 w-4" /> },
  { type: "callout", label: "Callout", icon: <MessageSquare className="h-4 w-4" /> },
];

/** Map from source block type to allowed target types. */
const ALLOWED_TARGETS: Record<BlockType, BlockType[]> = {
  paragraph: ["h1", "h2", "h3", "bullet", "number", "check", "quote", "code", "callout"],
  h1: ["paragraph", "h2", "h3", "quote"],
  h2: ["paragraph", "h1", "h3", "quote"],
  h3: ["paragraph", "h1", "h2", "quote"],
  bullet: ["number", "check", "paragraph"],
  number: ["bullet", "check", "paragraph"],
  check: ["bullet", "number", "paragraph"],
  quote: ["paragraph", "h1", "h2", "h3", "callout"],
  code: ["paragraph"],
  callout: ["paragraph", "quote"],
};

export interface TurnIntoPayload {
  targetType: BlockType;
}

export const TURN_INTO_COMMAND: LexicalCommand<TurnIntoPayload> =
  createCommand("TURN_INTO_COMMAND");

/** Detect the current block type from the selection anchor. */
export function $getActiveBlockType(): BlockType | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return null;

  const anchorNode = selection.anchor.getNode();
  let element: LexicalNode | null = anchorNode;

  // Walk up to find the nearest block-level element
  while (element !== null && !isBlockElement(element)) {
    element = element.getParent();
  }

  if (element === null) return null;

  if ($isHeadingNode(element)) {
    const tag = element.getTag();
    if (tag === "h1") return "h1";
    if (tag === "h2") return "h2";
    if (tag === "h3") return "h3";
  }
  if ($isListNode(element)) {
    const listType = element.getListType();
    if (listType === "bullet") return "bullet";
    if (listType === "number") return "number";
    if (listType === "check") return "check";
  }
  if ($isQuoteNode(element)) return "quote";
  if ($isCodeNode(element)) return "code";
  if ($isCalloutNode(element)) return "callout";
  if (element.getType() === "paragraph") return "paragraph";

  return null;
}

function isBlockElement(node: LexicalNode): boolean {
  return (
    $isElementNode(node) &&
    !node.isInline() &&
    (node.getType() === "paragraph" ||
      $isHeadingNode(node) ||
      $isListNode(node) ||
      $isQuoteNode(node) ||
      $isCodeNode(node) ||
      $isCalloutNode(node))
  );
}

/** Get the allowed "Turn into" options for a given source block type. */
export function getTargetOptions(sourceType: BlockType): TurnIntoOption[] {
  const allowed = ALLOWED_TARGETS[sourceType];
  if (!allowed) return [];
  return TURN_INTO_OPTIONS.filter((opt) => allowed.includes(opt.type));
}

export function TurnIntoPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      TURN_INTO_COMMAND,
      (payload: TurnIntoPayload) => {
        const { targetType } = payload;
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return false;

        // For list types, use Lexical's list commands which handle
        // converting from any block type (including other lists) properly.
        if (targetType === "bullet") {
          // First remove existing list if in one, then insert new
          editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
          return true;
        }
        if (targetType === "number") {
          editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
          return true;
        }
        if (targetType === "check") {
          editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
          return true;
        }

        // For non-list targets, if we're currently in a list, remove it first
        // to convert list items back to paragraphs, then transform those.
        const anchorNode = selection.anchor.getNode();
        let currentBlock: LexicalNode | null = anchorNode;
        while (currentBlock !== null && !isBlockElement(currentBlock)) {
          currentBlock = currentBlock.getParent();
        }

        if (currentBlock && $isListNode(currentBlock)) {
          editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
          // After removing the list, re-get selection and transform
          const newSelection = $getSelection();
          if ($isRangeSelection(newSelection)) {
            applyBlockTransform(newSelection, targetType);
          }
          return true;
        }

        // For callout source, extract children to a new block
        if (currentBlock && $isCalloutNode(currentBlock)) {
          const children = currentBlock.getChildren();
          const newBlock = createBlockNode(targetType);
          if (newBlock && $isElementNode(newBlock)) {
            children.forEach((child) => (newBlock as ElementNode).append(child));
            currentBlock.replace(newBlock);
            newBlock.selectEnd();
          }
          return true;
        }

        applyBlockTransform(selection, targetType);
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  }, [editor]);

  return null;
}

function applyBlockTransform(
  selection: ReturnType<typeof $getSelection>,
  targetType: BlockType,
): void {
  if (!$isRangeSelection(selection)) return;

  if (targetType === "callout") {
    // Callout is a custom node — extract text from current block, replace with callout
    const anchorNode = selection.anchor.getNode();
    let currentBlock: LexicalNode | null = anchorNode;
    while (currentBlock !== null && !isBlockElement(currentBlock)) {
      currentBlock = currentBlock.getParent();
    }
    if (currentBlock && $isElementNode(currentBlock)) {
      const children = currentBlock.getChildren();
      const callout = $createCalloutNode();
      children.forEach((child) => callout.append(child));
      currentBlock.replace(callout);
      callout.selectEnd();
    }
    return;
  }

  const creator = () => createBlockNode(targetType)!;
  $setBlocksType(selection, creator);
}

function createBlockNode(targetType: BlockType): ElementNode | null {
  switch (targetType) {
    case "paragraph":
      return $createParagraphNode();
    case "h1":
      return $createHeadingNode("h1" as HeadingTagType);
    case "h2":
      return $createHeadingNode("h2" as HeadingTagType);
    case "h3":
      return $createHeadingNode("h3" as HeadingTagType);
    case "quote":
      return $createQuoteNode();
    case "code":
      return $createCodeNode("plain");
    case "callout":
      return $createCalloutNode();
    default:
      return null;
  }
}
