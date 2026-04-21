"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
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
import {
  TableNode,
  TableRowNode,
  TableCellNode,
} from "@lexical/table";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import type {
  EditorState,
  LexicalEditor,
  SerializedEditorState,
} from "lexical";
import { lazyCaptureException } from "@/lib/capture";
import { isTransientNetworkError } from "@/lib/sentry";
import { editorTheme } from "@/components/editor/theme";
import { SlashCommandPlugin } from "@/components/editor/slash-command-plugin";
import { FloatingToolbarPlugin } from "@/components/editor/floating-toolbar-plugin";
import { FloatingLinkEditorPlugin } from "@/components/editor/floating-link-editor-plugin";
import { FloatingImageToolbarPlugin } from "@/components/editor/floating-image-toolbar-plugin";
import { CodeHighlightPlugin } from "@/components/editor/code-highlight-plugin";
import { DraggableBlockPlugin } from "@/components/editor/draggable-block-plugin";
import { MARKDOWN_TRANSFORMERS } from "@/components/editor/markdown-utils";
import { ImageNode } from "@/components/editor/image-node";
import { ImagePlugin } from "@/components/editor/image-plugin";
import { CalloutNode } from "@/components/editor/callout-node";
import { CalloutPlugin } from "@/components/editor/callout-plugin";
import {
  CollapsibleContainerNode,
  CollapsibleTitleNode,
  CollapsibleContentNode,
} from "@/components/editor/collapsible-node";
import { CollapsiblePlugin } from "@/components/editor/collapsible-plugin";
import { PageLinkNode } from "@/components/editor/page-link-node";
import { PageLinkPlugin } from "@/components/editor/page-link-plugin";
import { TableActionMenuPlugin } from "@/components/editor/table-action-menu-plugin";
import { WordCountPlugin } from "@/components/editor/word-count-plugin";
import { EditorAutoLinkPlugin } from "@/components/editor/auto-link-plugin";
import { getClient } from "@/lib/supabase/lazy-client";

const SAVE_DEBOUNCE_MS = 500;
const VERSION_SAVE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/** Extract all PageLinkNode pageIds from a serialized editor state. */
function extractPageLinkIds(
  state: SerializedEditorState,
): string[] {
  const ids: string[] = [];

  function walk(node: Record<string, unknown>) {
    if (node.type === "page-link" && typeof node.pageId === "string") {
      ids.push(node.pageId);
    }
    const children = node.children;
    if (Array.isArray(children)) {
      for (const child of children) {
        walk(child as Record<string, unknown>);
      }
    }
  }

  const root = state.root;
  if (root && typeof root === "object") {
    walk(root as Record<string, unknown>);
  }

  // Deduplicate
  return [...new Set(ids)];
}

/** Sync page_links table to match the current set of linked page IDs. */
async function syncPageLinks(
  pageId: string,
  workspaceId: string,
  linkedPageIds: string[],
): Promise<void> {
  const supabase = await getClient();

  // Fetch current links from this page
  const { data: existing } = await supabase
    .from("page_links")
    .select("id, target_page_id")
    .eq("source_page_id", pageId);

  const currentLinks = existing ?? [];
  const currentTargetIds = new Set(currentLinks.map((l) => l.target_page_id));
  const desiredTargetIds = new Set(linkedPageIds);

  // Links to add
  const toAdd = linkedPageIds.filter((id) => !currentTargetIds.has(id));
  // Links to remove
  const toRemove = currentLinks.filter(
    (l) => !desiredTargetIds.has(l.target_page_id),
  );

  if (toAdd.length > 0) {
    await supabase.from("page_links").insert(
      toAdd.map((targetId) => ({
        workspace_id: workspaceId,
        source_page_id: pageId,
        target_page_id: targetId,
      })),
    );
  }

  if (toRemove.length > 0) {
    await supabase
      .from("page_links")
      .delete()
      .in(
        "id",
        toRemove.map((l) => l.id),
      );
  }
}

interface EditorProps {
  pageId: string;
  workspaceId: string;
  initialContent: SerializedEditorState | null;
  editorRef?: React.MutableRefObject<LexicalEditor | null>;
  readOnly?: boolean;
}

function validateUrl(url: string): boolean {
  // Accept protocol-only URLs like "https://" used as placeholders during
  // link creation — the user edits the URL in the floating link editor.
  if (url === "https://" || url === "http://") return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function EditorRefPlugin({
  editorRef,
}: {
  editorRef: React.MutableRefObject<LexicalEditor | null>;
}): null {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editorRef.current = editor;
    return () => {
      editorRef.current = null;
    };
  }, [editor, editorRef]);
  return null;
}

export function Editor({ pageId, workspaceId, initialContent, editorRef, readOnly }: EditorProps) {
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>(
    initialContent ? JSON.stringify(initialContent) : ""
  );
  const lastVersionSavedAtRef = useRef<number>(0);
  const [floatingAnchorElem, setFloatingAnchorElem] =
    useState<HTMLDivElement | null>(null);

  const onFloatingAnchorRef = useCallback((node: HTMLDivElement | null) => {
    if (node !== null) {
      setFloatingAnchorElem(node);
    }
  }, []);

  const handleChange = useCallback(
    (editorState: EditorState) => {
      const json = editorState.toJSON();
      const serialized = JSON.stringify(json);

      if (serialized === lastSavedRef.current) return;

      setSaveStatus("saving");

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(async () => {
        const supabase = await getClient();
        const { error } = await supabase
          .from("pages")
          .update({ content: json })
          .eq("id", pageId);

        if (!error) {
          lastSavedRef.current = serialized;
          setSaveStatus("saved");

          // Sync page_links in the background after successful save
          const linkedPageIds = extractPageLinkIds(json);
          syncPageLinks(pageId, workspaceId, linkedPageIds).catch((err) =>
            lazyCaptureException(err),
          );

          // Save a version snapshot at intervals (every 5 minutes)
          const now = Date.now();
          if (now - lastVersionSavedAtRef.current >= VERSION_SAVE_INTERVAL_MS) {
            lastVersionSavedAtRef.current = now;
            fetch(`/api/pages/${pageId}/versions`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content: json }),
            }).catch((err) => {
              if (err instanceof Error && isTransientNetworkError(err)) {
                lazyCaptureException(err, { level: "warning" });
              } else {
                lazyCaptureException(err);
              }
            });
          }
        } else {
          lazyCaptureException(error);
          setSaveStatus("error");
        }
      }, SAVE_DEBOUNCE_MS);
    },
    [pageId, workspaceId]
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // Reset "saved" indicator after 2 seconds; retry save on error after 3 seconds
  useEffect(() => {
    if (saveStatus === "saved") {
      const timer = setTimeout(() => setSaveStatus("idle"), 2000);
      return () => clearTimeout(timer);
    }
    if (saveStatus === "error") {
      const timer = setTimeout(() => setSaveStatus("idle"), 5000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  const initialConfig = {
    namespace: "MemoEditor",
    theme: editorTheme,
    editable: !readOnly,
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
      ImageNode,
      CalloutNode,
      CollapsibleContainerNode,
      CollapsibleTitleNode,
      CollapsibleContentNode,
      PageLinkNode,
      TableNode,
      TableRowNode,
      TableCellNode,
    ],
    onError: (error: Error) => {
      lazyCaptureException(error);
    },
    editorState: initialContent
      ? JSON.stringify(initialContent)
      : undefined,
  };

  return (
    <div className="relative">
      <LexicalComposer initialConfig={initialConfig}>
        <div className="relative -ml-8 pl-8" ref={onFloatingAnchorRef}>
          <RichTextPlugin
            contentEditable={
              readOnly ? (
                <ContentEditable
                  className="outline-none min-h-[200px] text-sm opacity-70"
                />
              ) : (
                <ContentEditable
                  className="outline-none min-h-[200px] text-sm"
                  aria-placeholder="Type '/' for commands"
                  placeholder={
                    <div className="pointer-events-none absolute top-0.5 left-8 text-sm text-muted-foreground">
                      Type &apos;/&apos; for commands
                    </div>
                  }
                />
              )
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
        {!readOnly && (
          <>
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
            <ImagePlugin />
            <CalloutPlugin />
            <CollapsiblePlugin />
            <PageLinkPlugin />
            <TablePlugin
              hasCellMerge={false}
              hasCellBackgroundColor={false}
              hasTabHandler={true}
            />
            <TableActionMenuPlugin />
            <OnChangePlugin
              onChange={handleChange}
              ignoreSelectionChange
            />
            <SlashCommandPlugin />
            {floatingAnchorElem && (
              <>
                <FloatingToolbarPlugin anchorElem={floatingAnchorElem} />
                <FloatingLinkEditorPlugin anchorElem={floatingAnchorElem} />
                <FloatingImageToolbarPlugin anchorElem={floatingAnchorElem} />
                <DraggableBlockPlugin anchorElem={floatingAnchorElem} />
              </>
            )}
            <WordCountPlugin />
          </>
        )}
        {readOnly && (
          <>
            <ListPlugin />
            <CodeHighlightPlugin />
          </>
        )}
        {editorRef && <EditorRefPlugin editorRef={editorRef} />}
      </LexicalComposer>
      {!readOnly && (
        <div className="mt-2 h-5 text-xs text-muted-foreground">
          {saveStatus === "saving" && "Saving..."}
          {saveStatus === "saved" && "Saved"}
          {saveStatus === "error" && (
            <span className="text-destructive">Save failed</span>
          )}
        </div>
      )}
      {readOnly && (
        <div className="mt-2 h-5 text-xs text-muted-foreground">
          Previewing version (read-only)
        </div>
      )}
    </div>
  );
}
