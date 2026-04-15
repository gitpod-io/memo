import {
  $convertToMarkdownString,
  $convertFromMarkdownString,
  HEADING,
  QUOTE,
  CODE,
  UNORDERED_LIST,
  ORDERED_LIST,
  CHECK_LIST,
  LINK,
  BOLD_STAR,
  ITALIC_STAR,
  STRIKETHROUGH,
  INLINE_CODE,
  type Transformer,
  type ElementTransformer,
} from "@lexical/markdown";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import {
  $createParagraphNode,
  $getRoot,
  createEditor,
  type LexicalEditor,
  type SerializedEditorState,
} from "lexical";
import { $createHorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListNode, ListItemNode } from "@lexical/list";
import { CodeNode, CodeHighlightNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";

// Custom transformer for horizontal rules (not included in @lexical/markdown defaults)
const HORIZONTAL_RULE: ElementTransformer = {
  dependencies: [HorizontalRuleNode],
  export: (node) => {
    if (node.getType() === "horizontalrule") {
      return "---";
    }
    return null;
  },
  regExp: /^(?:---|\*\*\*|___)\s*$/,
  replace: (parentNode) => {
    const hrNode = $createHorizontalRuleNode();
    parentNode.replace(hrNode);
  },
  type: "element",
};

// All transformers used for markdown conversion, matching the editor's registered nodes
export const MARKDOWN_TRANSFORMERS: Transformer[] = [
  HEADING,
  QUOTE,
  CODE,
  UNORDERED_LIST,
  ORDERED_LIST,
  CHECK_LIST,
  HORIZONTAL_RULE,
  LINK,
  BOLD_STAR,
  ITALIC_STAR,
  STRIKETHROUGH,
  INLINE_CODE,
];

// Nodes matching the editor's initialConfig.nodes
const EDITOR_NODES = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  CodeNode,
  CodeHighlightNode,
  LinkNode,
  HorizontalRuleNode,
];

/**
 * Convert the current editor state to a markdown string.
 * Must be called inside editor.read() or editor.update().
 */
export function $editorStateToMarkdown(): string {
  return $convertToMarkdownString(MARKDOWN_TRANSFORMERS);
}

/**
 * Export the editor's content as a markdown string.
 * Reads the editor state and converts it.
 */
export function exportEditorToMarkdown(editor: LexicalEditor): string {
  let markdown = "";
  editor.getEditorState().read(() => {
    markdown = $editorStateToMarkdown();
  });
  return markdown;
}

/**
 * Trigger a browser download of a markdown string as a .md file.
 */
export function downloadMarkdown(markdown: string, filename: string): void {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".md") ? filename : `${filename}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parse a markdown string into a Lexical SerializedEditorState.
 * Creates a temporary headless editor to perform the conversion.
 */
export function parseMarkdownToEditorState(
  markdown: string
): SerializedEditorState {
  const editor = createEditor({
    namespace: "MarkdownImport",
    nodes: EDITOR_NODES,
    onError: (error) => {
      throw error;
    },
  });

  editor.update(
    () => {
      const root = $getRoot();
      // Clear default empty paragraph
      root.clear();
      // Convert markdown to editor nodes
      $convertFromMarkdownString(markdown, MARKDOWN_TRANSFORMERS, root, true);

      // If root is empty after conversion, add an empty paragraph
      if (root.getChildrenSize() === 0) {
        root.append($createParagraphNode());
      }
    },
    { discrete: true }
  );

  return editor.getEditorState().toJSON();
}

/**
 * Read a File object as text.
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}
