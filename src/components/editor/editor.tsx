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
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ClickableLinkPlugin } from "@lexical/react/LexicalClickableLinkPlugin";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListNode, ListItemNode } from "@lexical/list";
import { CodeNode, CodeHighlightNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import type {
  EditorState,
  LexicalEditor,
  SerializedEditorState,
} from "lexical";
import * as Sentry from "@sentry/nextjs";
import { editorTheme } from "@/components/editor/theme";
import { SlashCommandPlugin } from "@/components/editor/slash-command-plugin";
import { FloatingToolbarPlugin } from "@/components/editor/floating-toolbar-plugin";
import { FloatingLinkEditorPlugin } from "@/components/editor/floating-link-editor-plugin";
import { CodeHighlightPlugin } from "@/components/editor/code-highlight-plugin";
import { DraggableBlockPlugin } from "@/components/editor/draggable-block-plugin";
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
import { createClient } from "@/lib/supabase/client";

const SAVE_DEBOUNCE_MS = 500;

interface EditorProps {
  pageId: string;
  initialContent: SerializedEditorState | null;
  editorRef?: React.MutableRefObject<LexicalEditor | null>;
}

function validateUrl(url: string): boolean {
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

export function Editor({ pageId, initialContent, editorRef }: EditorProps) {
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>(
    initialContent ? JSON.stringify(initialContent) : ""
  );
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
        const supabase = createClient();
        const { error } = await supabase
          .from("pages")
          .update({ content: json })
          .eq("id", pageId);

        if (!error) {
          lastSavedRef.current = serialized;
          setSaveStatus("saved");
        } else {
          Sentry.captureException(error);
          setSaveStatus("error");
        }
      }, SAVE_DEBOUNCE_MS);
    },
    [pageId]
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
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      CodeNode,
      CodeHighlightNode,
      LinkNode,
      HorizontalRuleNode,
      ImageNode,
      CalloutNode,
      CollapsibleContainerNode,
      CollapsibleTitleNode,
      CollapsibleContentNode,
    ],
    onError: (error: Error) => {
      Sentry.captureException(error);
    },
    editorState: initialContent
      ? JSON.stringify(initialContent)
      : undefined,
  };

  return (
    <div className="relative">
      <LexicalComposer initialConfig={initialConfig}>
        <div className="relative" ref={onFloatingAnchorRef}>
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="outline-none min-h-[200px] text-sm"
                aria-placeholder="Type '/' for commands"
                placeholder={
                  <div className="pointer-events-none absolute top-0 left-0 text-sm text-muted-foreground">
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
        <LinkPlugin validateUrl={validateUrl} />
        <ClickableLinkPlugin />
        <HorizontalRulePlugin />
        <CodeHighlightPlugin />
        <ImagePlugin />
        <CalloutPlugin />
        <CollapsiblePlugin />
        {editorRef && <EditorRefPlugin editorRef={editorRef} />}
        <OnChangePlugin
          onChange={handleChange}
          ignoreSelectionChange
        />
        <SlashCommandPlugin />
        {floatingAnchorElem && (
          <>
            <FloatingToolbarPlugin anchorElem={floatingAnchorElem} />
            <FloatingLinkEditorPlugin anchorElem={floatingAnchorElem} />
            <DraggableBlockPlugin anchorElem={floatingAnchorElem} />
          </>
        )}
      </LexicalComposer>
      <div className="mt-2 h-5 text-xs text-muted-foreground">
        {saveStatus === "saving" && "Saving..."}
        {saveStatus === "saved" && "Saved"}
        {saveStatus === "error" && (
          <span className="text-destructive">Save failed</span>
        )}
      </div>
    </div>
  );
}
