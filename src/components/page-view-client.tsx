"use client";

import { useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { LexicalEditor, SerializedEditorState } from "lexical";
import { toast } from "@/lib/toast";
import { lazyCaptureException } from "@/lib/sentry";
import { getClient } from "@/lib/supabase/lazy-client";
import { trackEventClient } from "@/lib/track-event";
import { useMarkdownImport } from "@/lib/use-markdown-import";
import { PageTitle } from "@/components/page-title";
import { PageIcon } from "@/components/page-icon";
import { PageCover } from "@/components/page-cover";

const VersionHistoryPanel = dynamic(
  () =>
    import("@/components/version-history-panel").then(
      (mod) => mod.VersionHistoryPanel,
    ),
  { ssr: false },
);


const Editor = dynamic(
  () => import("@/components/editor/editor").then((mod) => mod.Editor),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-3">
        <div className="h-4 w-full animate-pulse bg-muted" />
        <div className="h-4 w-5/6 animate-pulse bg-muted" />
        <div className="h-4 w-4/6 animate-pulse bg-muted" />
      </div>
    ),
  },
);

const PageMenu = dynamic(
  () => import("@/components/page-menu").then((mod) => mod.PageMenu),
  {
    ssr: false,
    loading: () => <div className="h-8 w-8" />,
  },
);

interface PageViewClientProps {
  pageId: string;
  pageTitle: string;
  pageIcon: string | null;
  pageCoverUrl: string | null;
  initialContent: SerializedEditorState | null;
  workspaceId: string;
  workspaceSlug: string;
  userId: string;
}

export function PageViewClient({
  pageId,
  pageTitle,
  pageIcon,
  pageCoverUrl,
  initialContent,
  workspaceId,
  workspaceSlug,
  userId,
}: PageViewClientProps) {
  const editorRef = useRef<LexicalEditor | null>(null);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<SerializedEditorState | null>(null);

  const handlePreview = useCallback((content: SerializedEditorState) => {
    setPreviewContent(content);
  }, []);

  const handleRestore = useCallback(
    (content: SerializedEditorState) => {
      // Update the live editor with the restored content
      const editor = editorRef.current;
      if (editor) {
        const editorState = editor.parseEditorState(JSON.stringify(content));
        editor.setEditorState(editorState);
      }
      setPreviewContent(null);
    },
    [],
  );

  const handleExitPreview = useCallback(() => {
    setPreviewContent(null);
  }, []);

  const handleVersionHistoryOpen = useCallback(() => {
    setVersionHistoryOpen(true);
  }, []);

  const handleTitleAdvance = useCallback(() => {
    editorRef.current?.focus();
  }, []);

  // Slash-menu export: reuses the same flow as the page menu export.
  // Lazy-loads markdown-utils to keep Lexical out of the initial page chunk.
  const handleSlashExport = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) {
      toast.error("Editor not ready", { duration: 8000 });
      return;
    }

    try {
      const { exportEditorToMarkdown, downloadMarkdown } = await import(
        "@/components/editor/markdown-utils"
      );
      const markdown = exportEditorToMarkdown(editor);
      const filename = (pageTitle.trim() || "Untitled") + ".md";
      downloadMarkdown(markdown, filename);

      getClient()
        .then((supabase) => {
          trackEventClient(supabase, "editor.export", userId, {
            workspaceId,
            metadata: { page_id: pageId, source: "slash-menu" },
          });
        })
        .catch(() => {
          // Client init failed — skip tracking silently
        });
    } catch (error) {
      lazyCaptureException(error);
      toast.error("Export failed", { duration: 8000 });
    }
  }, [pageTitle, userId, workspaceId, pageId]);

  // Slash-menu import: reuses the same useMarkdownImport hook as the page menu
  const {
    fileInputRef: slashImportInputRef,
    triggerFileInput: handleSlashImport,
    handleFileChange: handleSlashImportFileChange,
  } = useMarkdownImport({
    workspaceId,
    workspaceSlug,
    userId,
    source: "slash-menu",
  });

  // When previewing a version, show a read-only editor with that content
  const isPreviewMode = previewContent !== null;

  return (
    <>
      <div className="group/page-header">
        <PageCover
          key={`cover-${pageId}`}
          pageId={pageId}
          initialCoverUrl={pageCoverUrl}
        />
        <PageIcon key={`icon-${pageId}`} pageId={pageId} initialIcon={pageIcon} />
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <PageTitle key={pageId} pageId={pageId} initialTitle={pageTitle} onAdvance={handleTitleAdvance} />
          </div>
          <PageMenu
            pageId={pageId}
            pageTitle={pageTitle}
            workspaceId={workspaceId}
            workspaceSlug={workspaceSlug}
            userId={userId}
            editorRef={editorRef}
            onVersionHistoryOpen={handleVersionHistoryOpen}
          />
        </div>
      </div>
      <div className="mt-4">
        {isPreviewMode ? (
          <Editor
            key={`preview-${pageId}`}
            pageId={pageId}
            workspaceId={workspaceId}
            initialContent={previewContent}
            readOnly
          />
        ) : (
          <Editor
            key={pageId}
            pageId={pageId}
            workspaceId={workspaceId}
            initialContent={initialContent}
            editorRef={editorRef}
            onSlashExport={handleSlashExport}
            onSlashImport={handleSlashImport}
          />
        )}
      </div>
      <VersionHistoryPanel
        open={versionHistoryOpen}
        onOpenChange={setVersionHistoryOpen}
        pageId={pageId}
        onPreview={handlePreview}
        onRestore={handleRestore}
        onExitPreview={handleExitPreview}
      />
      <input
        ref={slashImportInputRef}
        type="file"
        accept=".md,.markdown"
        className="hidden"
        onChange={handleSlashImportFileChange}
        aria-label="Import markdown file from slash menu"
      />
    </>
  );
}
