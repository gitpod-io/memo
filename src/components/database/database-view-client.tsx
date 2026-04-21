"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import type { SerializedEditorState } from "lexical";
import { PageTitle } from "@/components/page-title";
import { PageIcon } from "@/components/page-icon";
import { PageCover } from "@/components/page-cover";
import { ViewTabs } from "@/components/database/view-tabs";
import { loadDatabase } from "@/lib/database";
import type {
  DatabaseProperty,
  DatabaseRow,
  DatabaseView,
  DatabaseViewType,
} from "@/lib/types";

// Dynamically import the table view to code-split database view components
const TableView = dynamic(
  () =>
    import("@/components/database/views/table-view").then(
      (mod) => mod.TableView,
    ),
  { ssr: false },
);

// Dynamically import the editor only when the database page has content above the grid
const Editor = dynamic(
  () => import("@/components/editor/editor").then((mod) => mod.Editor),
  { ssr: false },
);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DatabaseViewClientProps {
  pageId: string;
  pageTitle: string;
  pageIcon: string | null;
  pageCoverUrl: string | null;
  initialContent: SerializedEditorState | null;
  workspaceId: string;
  workspaceSlug: string;
  userId: string;
}

// ---------------------------------------------------------------------------
// Coming Soon placeholder for non-table view types
// ---------------------------------------------------------------------------

function ComingSoonPlaceholder({ viewType }: { viewType: DatabaseViewType }) {
  return (
    <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
      {viewType.charAt(0).toUpperCase() + viewType.slice(1)} view coming soon
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function DatabaseSkeleton() {
  return (
    <div className="space-y-3">
      {/* View tabs skeleton */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2">
        <div className="h-5 w-20 animate-pulse bg-muted" />
        <div className="h-5 w-20 animate-pulse bg-muted" />
        <div className="h-5 w-20 animate-pulse bg-muted" />
      </div>
      {/* Table skeleton */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="h-8 w-1/4 animate-pulse bg-muted" />
          <div className="h-8 w-1/4 animate-pulse bg-muted" />
          <div className="h-8 w-1/4 animate-pulse bg-muted" />
          <div className="h-8 w-1/4 animate-pulse bg-muted" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-2">
            <div className="h-10 w-1/4 animate-pulse bg-muted" />
            <div className="h-10 w-1/4 animate-pulse bg-muted" />
            <div className="h-10 w-1/4 animate-pulse bg-muted" />
            <div className="h-10 w-1/4 animate-pulse bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DatabaseViewClient
// ---------------------------------------------------------------------------

export function DatabaseViewClient(props: DatabaseViewClientProps) {
  const {
    pageId,
    pageTitle,
    pageIcon,
    pageCoverUrl,
    initialContent,
    workspaceId,
    workspaceSlug,
  } = props;
  const router = useRouter();
  const searchParams = useSearchParams();

  // Database data state
  const [properties, setProperties] = useState<DatabaseProperty[]>([]);
  const [views, setViews] = useState<DatabaseView[]>([]);
  const [rows, setRows] = useState<DatabaseRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Active view: from URL ?view= param, or first view by position
  const viewIdFromUrl = searchParams.get("view");

  const activeViewId = useMemo(() => {
    if (viewIdFromUrl && views.some((v) => v.id === viewIdFromUrl)) {
      return viewIdFromUrl;
    }
    return views[0]?.id ?? "";
  }, [viewIdFromUrl, views]);

  const activeView = useMemo(
    () => views.find((v) => v.id === activeViewId),
    [views, activeViewId],
  );

  // Load database data on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data, error } = await loadDatabase(pageId);
      if (cancelled) return;

      if (error || !data) {
        setLoading(false);
        return;
      }

      setProperties(data.properties);
      setViews(data.views);
      setRows(data.rows);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [pageId]);

  // Handle view tab change — update URL ?view= param
  const handleViewChange = useCallback(
    (viewId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", viewId);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  // Check if there's Lexical content to render above the database
  const hasContent =
    initialContent !== null &&
    initialContent !== undefined &&
    typeof initialContent === "object" &&
    "root" in initialContent;

  return (
    <>
      <div className="group/page-header">
        <PageCover
          key={`cover-${pageId}`}
          pageId={pageId}
          initialCoverUrl={pageCoverUrl}
        />
        <PageIcon
          key={`icon-${pageId}`}
          pageId={pageId}
          initialIcon={pageIcon}
        />
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <PageTitle key={pageId} pageId={pageId} initialTitle={pageTitle} />
          </div>
        </div>
      </div>

      {/* Optional Lexical content above the database grid */}
      {hasContent && (
        <div className="mt-4">
          <Editor
            key={`db-content-${pageId}`}
            pageId={pageId}
            workspaceId={workspaceId}
            initialContent={initialContent}
          />
        </div>
      )}

      {/* Database view area */}
      <div className="mt-6">
        {loading ? (
          <DatabaseSkeleton />
        ) : (
          <>
            {views.length > 0 && (
              <ViewTabs
                views={views}
                activeViewId={activeViewId}
                onViewChange={handleViewChange}
              />
            )}

            <div className="mt-0">
              {activeView?.type === "table" ? (
                <TableView
                  rows={rows}
                  properties={properties}
                  viewConfig={activeView.config}
                  workspaceSlug={workspaceSlug}
                />
              ) : activeView ? (
                <ComingSoonPlaceholder viewType={activeView.type} />
              ) : null}
            </div>
          </>
        )}
      </div>
    </>
  );
}
