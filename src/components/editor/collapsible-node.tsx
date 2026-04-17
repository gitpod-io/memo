"use client";

import type {
  DOMExportOutput,
  LexicalNode,
  NodeKey,
  SerializedElementNode,
  Spread,
} from "lexical";
import {
  $applyNodeReplacement,
  $createParagraphNode,
  ElementNode,
} from "lexical";

// --- CollapsibleContainerNode ---

export type SerializedCollapsibleContainerNode = Spread<
  { open: boolean },
  SerializedElementNode
>;

export class CollapsibleContainerNode extends ElementNode {
  __open: boolean;

  static getType(): string {
    return "collapsible-container";
  }

  static clone(node: CollapsibleContainerNode): CollapsibleContainerNode {
    return new CollapsibleContainerNode(node.__open, node.__key);
  }

  static importJSON(
    serializedNode: SerializedCollapsibleContainerNode
  ): CollapsibleContainerNode {
    const node = $createCollapsibleContainerNode(serializedNode.open);
    return node;
  }

  constructor(open?: boolean, key?: NodeKey) {
    super(key);
    this.__open = open ?? true;
  }

  exportJSON(): SerializedCollapsibleContainerNode {
    return {
      ...super.exportJSON(),
      type: "collapsible-container",
      version: 1,
      open: this.__open,
    };
  }

  createDOM(): HTMLElement {
    const details = document.createElement("details");
    details.className =
      "mt-3 border border-white/[0.06] text-sm rounded-sm";
    if (this.__open) {
      details.open = true;
    }
    return details;
  }

  updateDOM(
    prevNode: CollapsibleContainerNode,
    dom: HTMLDetailsElement
  ): boolean {
    if (prevNode.__open !== this.__open) {
      dom.open = this.__open;
    }
    return false;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("details");
    if (this.__open) element.open = true;
    return { element };
  }

  getOpen(): boolean {
    return this.getLatest().__open;
  }

  setOpen(open: boolean): void {
    const writable = this.getWritable();
    writable.__open = open;
  }

  toggleOpen(): void {
    this.setOpen(!this.getOpen());
  }

  isInline(): boolean {
    return false;
  }
}

// --- CollapsibleTitleNode ---

export type SerializedCollapsibleTitleNode = SerializedElementNode;

export class CollapsibleTitleNode extends ElementNode {
  static getType(): string {
    return "collapsible-title";
  }

  static clone(node: CollapsibleTitleNode): CollapsibleTitleNode {
    return new CollapsibleTitleNode(node.__key);
  }

  static importJSON(): CollapsibleTitleNode {
    return $createCollapsibleTitleNode();
  }

  exportJSON(): SerializedCollapsibleTitleNode {
    return {
      ...super.exportJSON(),
      type: "collapsible-title",
      version: 1,
    };
  }

  createDOM(): HTMLElement {
    const summary = document.createElement("summary");
    summary.className =
      "flex items-center gap-1.5 p-3 text-sm font-medium text-foreground hover:bg-white/[0.04] list-none";

    // Add a toggle chevron button as the visual affordance.
    // The chevron rotates when the parent <details> is open.
    const chevron = document.createElement("button");
    chevron.type = "button";
    chevron.contentEditable = "false";
    chevron.className =
      "collapsible-toggle flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-white/[0.08] transition-transform duration-150";
    chevron.setAttribute("aria-label", "Toggle section");
    chevron.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
    summary.prepend(chevron);

    return summary;
  }

  updateDOM(): boolean {
    return false;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("summary");
    return { element };
  }

  isInline(): boolean {
    return false;
  }

  collapseAtStart(): boolean {
    // When backspacing at the start of the title, unwrap the collapsible
    const container = this.getParent();
    if (container instanceof CollapsibleContainerNode) {
      const contentNode = this.getNextSibling();
      const paragraph = $createParagraphNode();
      const children = this.getChildren();
      children.forEach((child) => paragraph.append(child));
      container.insertBefore(paragraph);

      // Move content children out of the container
      if (contentNode instanceof CollapsibleContentNode) {
        const contentChildren = contentNode.getChildren();
        contentChildren.forEach((child) => {
          container.insertBefore(child);
        });
      }

      container.remove();
      paragraph.selectStart();
      return true;
    }
    return false;
  }
}

// --- CollapsibleContentNode ---

export type SerializedCollapsibleContentNode = SerializedElementNode;

export class CollapsibleContentNode extends ElementNode {
  static getType(): string {
    return "collapsible-content";
  }

  static clone(node: CollapsibleContentNode): CollapsibleContentNode {
    return new CollapsibleContentNode(node.__key);
  }

  static importJSON(): CollapsibleContentNode {
    return $createCollapsibleContentNode();
  }

  exportJSON(): SerializedCollapsibleContentNode {
    return {
      ...super.exportJSON(),
      type: "collapsible-content",
      version: 1,
    };
  }

  createDOM(): HTMLElement {
    const div = document.createElement("div");
    div.className = "border-t border-white/[0.06] p-3 text-sm";
    return div;
  }

  updateDOM(): boolean {
    return false;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("div");
    return { element };
  }

  isInline(): boolean {
    return false;
  }
}

// --- Factory functions ---

export function $createCollapsibleContainerNode(
  open?: boolean
): CollapsibleContainerNode {
  return $applyNodeReplacement(new CollapsibleContainerNode(open));
}

export function $createCollapsibleTitleNode(): CollapsibleTitleNode {
  return $applyNodeReplacement(new CollapsibleTitleNode());
}

export function $createCollapsibleContentNode(): CollapsibleContentNode {
  return $applyNodeReplacement(new CollapsibleContentNode());
}

export function $isCollapsibleContainerNode(
  node: LexicalNode | null | undefined
): node is CollapsibleContainerNode {
  return node instanceof CollapsibleContainerNode;
}

export function $isCollapsibleTitleNode(
  node: LexicalNode | null | undefined
): node is CollapsibleTitleNode {
  return node instanceof CollapsibleTitleNode;
}

export function $isCollapsibleContentNode(
  node: LexicalNode | null | undefined
): node is CollapsibleContentNode {
  return node instanceof CollapsibleContentNode;
}
