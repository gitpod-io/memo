"use client";

import dynamic from "next/dynamic";
import type { SerializedEditorState } from "lexical";
import type { DatabaseProperty, RowValue } from "@/lib/types";
import type { LoadDatabaseResult } from "@/lib/database";

const DatabaseViewClient = dynamic(
  () =>
    import("@/components/database/database-view-client").then(
      (mod) => mod.DatabaseViewClient,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="mt-6 space-y-3">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 w-full animate-pulse rounded bg-muted" />
      </div>
    ),
  },
);

const RowPropertiesHeader = dynamic(
  () =>
    import("@/components/database/row-properties-header").then(
      (mod) => mod.RowPropertiesHeader,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="mb-4 space-y-2">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
      </div>
    ),
  },
);

const PageViewClient = dynamic(
  () =>
    import("@/components/page-view-client").then((mod) => mod.PageViewClient),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4">
        <div className="h-10 w-64 animate-pulse rounded bg-muted" />
        <div className="space-y-3">
          <div className="h-4 w-full animate-pulse bg-muted" />
          <div className="h-4 w-5/6 animate-pulse bg-muted" />
          <div className="h-4 w-4/6 animate-pulse bg-muted" />
        </div>
      </div>
    ),
  },
);

interface PageContentClientProps {
  pageId: string;
  pageTitle: string;
  pageIcon: string | null;
  pageCoverUrl: string | null;
  initialContent: SerializedEditorState | null;
  workspaceId: string;
  workspaceSlug: string;
  userId: string;
  isDatabase: boolean;
  isRowPage: boolean;
  rowProperties: DatabaseProperty[];
  rowValues: Record<string, RowValue>;
  pageCreatedAt: string;
  pageUpdatedAt: string;
  pageCreatedBy: string;
  initialDatabaseData: LoadDatabaseResult | null;
}

export function PageContentClient({
  pageId,
  pageTitle,
  pageIcon,
  pageCoverUrl,
  initialContent,
  workspaceId,
  workspaceSlug,
  userId,
  isDatabase,
  isRowPage,
  rowProperties,
  rowValues,
  pageCreatedAt,
  pageUpdatedAt,
  pageCreatedBy,
  initialDatabaseData,
}: PageContentClientProps) {
  if (isDatabase) {
    return (
      <DatabaseViewClient
        pageId={pageId}
        pageTitle={pageTitle}
        pageIcon={pageIcon}
        pageCoverUrl={pageCoverUrl}
        initialContent={initialContent}
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
        userId={userId}
        initialData={initialDatabaseData}
      />
    );
  }

  return (
    <>
      {isRowPage && rowProperties.length > 0 && (
        <RowPropertiesHeader
          pageId={pageId}
          properties={rowProperties}
          values={rowValues}
          pageCreatedAt={pageCreatedAt}
          pageUpdatedAt={pageUpdatedAt}
          pageCreatedBy={pageCreatedBy}
        />
      )}
      <PageViewClient
        pageId={pageId}
        pageTitle={pageTitle}
        pageIcon={pageIcon}
        pageCoverUrl={pageCoverUrl}
        initialContent={initialContent}
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
        userId={userId}
      />
    </>
  );
}
