"use client";

import type { JSX } from "react";
import { useCallback, useEffect, useState } from "react";
import type {
  DOMExportOutput,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
} from "lexical";
import {
  $applyNodeReplacement,
  $getNodeByKey,
  $getRoot,
  DecoratorNode,
} from "lexical";
import { $isHeadingNode, type HeadingTagType } from "@lexical/rich-text";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { List } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HeadingEntry {
  key: string;
  tag: HeadingTagType;
  text: string;
}

// ---------------------------------------------------------------------------
// TOC React component (rendered by DecoratorNode.decorate)
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 200;

const INDENT: Record<HeadingTagType, string> = {
  h1: "",
  h2: "pl-4",
  h3: "pl-8",
  h4: "pl-12",
  h5: "pl-16",
  h6: "pl-20",
};

function TableOfContentsComponent(): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const [headings, setHeadings] = useState<HeadingEntry[]>([]);

  // Scan headings from editor state
  useEffect(() => {
    function scanHeadings() {
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const entries: HeadingEntry[] = [];
        for (const child of root.getChildren()) {
          if ($isHeadingNode(child)) {
            const tag = child.getTag();
            if (tag === "h1" || tag === "h2" || tag === "h3") {
              entries.push({
                key: child.getKey(),
                tag,
                text: child.getTextContent(),
              });
            }
          }
        }
        setHeadings(entries);
      });
    }

    // Initial scan
    scanHeadings();

    // Listen for updates (debounced)
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const unregister = editor.registerUpdateListener(() => {
      if (timerId) clearTimeout(timerId);
      timerId = setTimeout(() => scanHeadings(), DEBOUNCE_MS);
    });

    return () => {
      if (timerId) clearTimeout(timerId);
      unregister();
    };
  }, [editor]);

  const handleClick = useCallback(
    (key: string) => {
      // Scroll the heading DOM element into view first
      const dom = editor.getElementByKey(key);
      if (dom) {
        dom.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      // Focus the heading by selecting it
      editor.update(() => {
        const node = $getNodeByKey(key);
        if (node) {
          node.selectStart();
        }
      });
    },
    [editor],
  );

  if (headings.length === 0) {
    return (
      <div
        className="my-2 flex items-center gap-2 border border-overlay-border px-3 py-3 text-sm text-muted-foreground"
        data-testid="toc-empty"
      >
        <List className="h-4 w-4 shrink-0" />
        Add headings to see a table of contents
      </div>
    );
  }

  return (
    <div
      className="my-2 border border-overlay-border px-3 py-2"
      data-testid="toc-block"
    >
      <div className="mb-1 text-xs font-medium uppercase tracking-widest text-label-faint">
        Table of Contents
      </div>
      <nav aria-label="Table of contents">
        <ul className="space-y-0.5">
          {headings.map((entry) => (
            <li key={entry.key} className={INDENT[entry.tag]}>
              <button
                type="button"
                onClick={() => handleClick(entry.key)}
                className="w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors py-0.5"
                data-testid={`toc-entry-${entry.tag}`}
              >
                {entry.text || "Untitled"}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Serialization types
// ---------------------------------------------------------------------------

export type SerializedTableOfContentsNode = SerializedLexicalNode;

// ---------------------------------------------------------------------------
// TableOfContentsNode — Lexical DecoratorNode
// ---------------------------------------------------------------------------

export class TableOfContentsNode extends DecoratorNode<JSX.Element> {
  static getType(): string {
    return "table-of-contents";
  }

  static clone(node: TableOfContentsNode): TableOfContentsNode {
    return new TableOfContentsNode(node.__key);
  }

  static importJSON(
    _: SerializedTableOfContentsNode,
  ): TableOfContentsNode {
    return $createTableOfContentsNode();
  }

  constructor(key?: NodeKey) {
    super(key);
  }

  exportJSON(): SerializedTableOfContentsNode {
    return {
      type: "table-of-contents",
      version: 1,
    };
  }

  createDOM(): HTMLElement {
    const div = document.createElement("div");
    div.className = "editor-toc";
    return div;
  }

  updateDOM(): false {
    return false;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("div");
    element.setAttribute("data-type", "table-of-contents");
    element.textContent = "[Table of Contents]";
    return { element };
  }

  isInline(): false {
    return false;
  }

  decorate(): JSX.Element {
    return <TableOfContentsComponent />;
  }
}

export function $createTableOfContentsNode(): TableOfContentsNode {
  return $applyNodeReplacement(new TableOfContentsNode());
}

export function $isTableOfContentsNode(
  node: LexicalNode | null | undefined,
): node is TableOfContentsNode {
  return node instanceof TableOfContentsNode;
}
