"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import type { LexicalEditor, SerializedEditorState } from "lexical";
import { PageTitle } from "@/components/page-title";
import { PageIcon } from "@/components/page-icon";
import { PageCover } from "@/components/page-cover";

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
          workspaceId={workspaceId}
          initialContent={initialContent}
          editorRef={editorRef}
        />
      </div>
    </>
  );
}
