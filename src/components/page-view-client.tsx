"use client";

import { useRef } from "react";
import type { LexicalEditor, SerializedEditorState } from "lexical";
import { PageTitle } from "@/components/page-title";
import { PageIcon } from "@/components/page-icon";
import { Editor } from "@/components/editor/editor";
import { PageMenu } from "@/components/page-menu";

interface PageViewClientProps {
  pageId: string;
  pageTitle: string;
  pageIcon: string | null;
  initialContent: SerializedEditorState | null;
  workspaceId: string;
  workspaceSlug: string;
  userId: string;
}

export function PageViewClient({
  pageId,
  pageTitle,
  pageIcon,
  initialContent,
  workspaceId,
  workspaceSlug,
  userId,
}: PageViewClientProps) {
  const editorRef = useRef<LexicalEditor | null>(null);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="group/page-header">
        <PageIcon key={`icon-${pageId}`} pageId={pageId} initialIcon={pageIcon} />
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <PageTitle key={pageId} pageId={pageId} initialTitle={pageTitle} />
          </div>
          <PageMenu
            pageId={pageId}
            pageTitle={pageTitle}
            workspaceId={workspaceId}
            workspaceSlug={workspaceSlug}
            userId={userId}
            editorRef={editorRef}
          />
        </div>
      </div>
      <div className="mt-4">
        <Editor
          key={pageId}
          pageId={pageId}
          initialContent={initialContent}
          editorRef={editorRef}
        />
      </div>
    </div>
  );
}
