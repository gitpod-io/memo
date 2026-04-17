"use client";

import type {
  DOMExportOutput,
  LexicalNode,
  NodeKey,
  RangeSelection,
  SerializedElementNode,
  Spread,
} from "lexical";
import {
  $applyNodeReplacement,
  $createParagraphNode,
  ElementNode,
} from "lexical";

export type CalloutVariant = "info" | "warning" | "success" | "error";

export type SerializedCalloutNode = Spread<
  {
    emoji: string;
    variant: CalloutVariant;
  },
  SerializedElementNode
>;

const VARIANT_CLASSES: Record<CalloutVariant, string> = {
  info: "border-l-accent bg-muted",
  warning: "border-l-code-type bg-muted",
  success: "border-l-code-string bg-muted",
  error: "border-l-destructive bg-muted",
};

const BASE_CLASSES = "mt-3 flex gap-3 border-l-2 p-4 text-sm";

export class CalloutNode extends ElementNode {
  __emoji: string;
  __variant: CalloutVariant;

  static getType(): string {
    return "callout";
  }

  static clone(node: CalloutNode): CalloutNode {
    return new CalloutNode(node.__emoji, node.__variant, node.__key);
  }

  static importJSON(serializedNode: SerializedCalloutNode): CalloutNode {
    const node = $createCalloutNode(
      serializedNode.emoji,
      serializedNode.variant
    );
    return node;
  }

  constructor(emoji?: string, variant?: CalloutVariant, key?: NodeKey) {
    super(key);
    this.__emoji = emoji ?? "💡";
    this.__variant = variant ?? "info";
  }

  exportJSON(): SerializedCalloutNode {
    return {
      ...super.exportJSON(),
      type: "callout",
      version: 1,
      emoji: this.__emoji,
      variant: this.__variant,
    };
  }

  createDOM(): HTMLElement {
    const div = document.createElement("div");
    div.className = `${BASE_CLASSES} ${VARIANT_CLASSES[this.__variant]}`;

    const emojiSpan = document.createElement("span");
    emojiSpan.className = "callout-emoji select-none text-lg shrink-0";
    emojiSpan.contentEditable = "false";
    emojiSpan.textContent = this.__emoji;
    div.appendChild(emojiSpan);

    return div;
  }

  updateDOM(prevNode: CalloutNode, dom: HTMLElement): boolean {
    if (prevNode.__variant !== this.__variant) {
      dom.className = `${BASE_CLASSES} ${VARIANT_CLASSES[this.__variant]}`;
    }
    if (prevNode.__emoji !== this.__emoji) {
      const emojiSpan = dom.querySelector(".callout-emoji");
      if (emojiSpan) {
        emojiSpan.textContent = this.__emoji;
      }
    }
    return false;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("div");
    element.className = "callout";
    element.setAttribute("data-variant", this.__variant);
    element.setAttribute("data-emoji", this.__emoji);
    return { element };
  }

  getEmoji(): string {
    return this.getLatest().__emoji;
  }

  setEmoji(emoji: string): void {
    const writable = this.getWritable();
    writable.__emoji = emoji;
  }

  getVariant(): CalloutVariant {
    return this.getLatest().__variant;
  }

  setVariant(variant: CalloutVariant): void {
    const writable = this.getWritable();
    writable.__variant = variant;
  }

  // Callout blocks can contain inline content (text, links, etc.)
  // but not other block-level elements
  canInsertTextBefore(): boolean {
    return true;
  }

  canInsertTextAfter(): boolean {
    return true;
  }

  isInline(): boolean {
    return false;
  }

  collapseAtStart(): boolean {
    const paragraph = $createParagraphNode();
    const children = this.getChildren();
    children.forEach((child) => paragraph.append(child));
    this.replace(paragraph);
    return true;
  }

  insertNewAfter(
    _selection: RangeSelection,
    restoreSelection?: boolean
  ): LexicalNode {
    const paragraph = $createParagraphNode();
    this.insertAfter(paragraph, restoreSelection);
    return paragraph;
  }
}

export function $createCalloutNode(
  emoji?: string,
  variant?: CalloutVariant
): CalloutNode {
  return $applyNodeReplacement(new CalloutNode(emoji, variant));
}

export function $isCalloutNode(
  node: LexicalNode | null | undefined
): node is CalloutNode {
  return node instanceof CalloutNode;
}
