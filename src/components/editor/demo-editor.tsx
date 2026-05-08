"use client";

import { useCallback, useState } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { ListTabIndentationPlugin } from "@/components/editor/list-tab-indentation-plugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ClickableLinkPlugin } from "@lexical/react/LexicalClickableLinkPlugin";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListNode, ListItemNode } from "@lexical/list";
import { CodeNode, CodeHighlightNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import { TableNode, TableRowNode, TableCellNode } from "@lexical/table";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { editorTheme } from "@/components/editor/theme";
import { DemoSlashCommandPlugin } from "@/components/editor/demo-slash-command-plugin";
import { FloatingToolbarPlugin } from "@/components/editor/floating-toolbar-plugin";
import { FloatingLinkEditorPlugin } from "@/components/editor/floating-link-editor-plugin";
import { CodeHighlightPlugin } from "@/components/editor/code-highlight-plugin";
import { CodeLanguageSelectorPlugin } from "@/components/editor/code-language-selector-plugin";
import { MARKDOWN_TRANSFORMERS } from "@/components/editor/markdown-utils";
import { CalloutNode } from "@/components/editor/callout-node";
import { CalloutPlugin } from "@/components/editor/callout-plugin";
import {
  CollapsibleContainerNode,
  CollapsibleTitleNode,
  CollapsibleContentNode,
} from "@/components/editor/collapsible-node";
import { CollapsiblePlugin } from "@/components/editor/collapsible-plugin";
import { TableActionMenuPlugin } from "@/components/editor/table-action-menu-plugin";
import { EditorAutoLinkPlugin } from "@/components/editor/auto-link-plugin";
import {
  LocalPersistencePlugin,
  loadDemoContent,
} from "@/components/editor/local-persistence-plugin";
import { lazyCaptureException } from "@/lib/sentry";

function validateUrl(url: string): boolean {
  if (url === "https://" || url === "http://") return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Standalone editor for the logged-out landing page. Uses sessionStorage for
 * persistence instead of Supabase. Excludes plugins that require auth context
 * (image upload, page links, database embeds, word count, drag-and-drop).
 */
export function DemoEditor() {
  const [floatingAnchorElem, setFloatingAnchorElem] =
    useState<HTMLDivElement | null>(null);

  const onFloatingAnchorRef = useCallback((node: HTMLDivElement | null) => {
    if (node !== null) {
      setFloatingAnchorElem(node);
    }
  }, []);

  const savedContent = loadDemoContent();

  const initialConfig = {
    namespace: "DemoEditor",
    theme: editorTheme,
    editable: true,
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      CodeNode,
      CodeHighlightNode,
      AutoLinkNode,
      LinkNode,
      HorizontalRuleNode,
      CalloutNode,
      CollapsibleContainerNode,
      CollapsibleTitleNode,
      CollapsibleContentNode,
      TableNode,
      TableRowNode,
      TableCellNode,
    ],
    onError: (error: Error) => {
      lazyCaptureException(error);
    },
    editorState: savedContent ?? undefined,
  };

  return (
    <div className="relative" data-testid="demo-editor">
      <LexicalComposer initialConfig={initialConfig}>
        <div className="relative" ref={onFloatingAnchorRef}>
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="outline-none min-h-[200px] text-sm"
                aria-label="Page content"
                aria-placeholder="Type '/' for commands"
                placeholder={
                  <div className="pointer-events-none absolute top-0.5 left-0 text-sm text-muted-foreground">
                    Type &apos;/&apos; for commands
                  </div>
                }
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
        <HistoryPlugin />
        <ListPlugin />
        <CheckListPlugin />
        <ListTabIndentationPlugin />
        <LinkPlugin validateUrl={validateUrl} />
        <EditorAutoLinkPlugin />
        <ClickableLinkPlugin />
        <HorizontalRulePlugin />
        <MarkdownShortcutPlugin transformers={MARKDOWN_TRANSFORMERS} />
        <CodeHighlightPlugin />
        <CodeLanguageSelectorPlugin />
        <CalloutPlugin />
        <CollapsiblePlugin />
        <TablePlugin
          hasCellMerge={false}
          hasCellBackgroundColor={false}
          hasTabHandler={true}
        />
        <TableActionMenuPlugin />
        <DemoSlashCommandPlugin />
        <LocalPersistencePlugin />
        {floatingAnchorElem && (
          <>
            <FloatingToolbarPlugin anchorElem={floatingAnchorElem} />
            <FloatingLinkEditorPlugin anchorElem={floatingAnchorElem} />
          </>
        )}
      </LexicalComposer>
    </div>
  );
}
