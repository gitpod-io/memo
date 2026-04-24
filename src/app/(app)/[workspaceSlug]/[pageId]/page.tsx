import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { captureSupabaseError } from "@/lib/sentry";
import { trackEvent } from "@/lib/track-event-server";
import type { SerializedEditorState } from "lexical";
import {
  PageBreadcrumb,
  type BreadcrumbItem,
} from "@/components/page-breadcrumb";
import { PageBacklinks } from "@/components/page-backlinks";
import { PageViewClient } from "@/components/page-view-client";
import { RowPropertiesHeader } from "@/components/database/row-properties-header";
import { DatabaseViewClient } from "@/components/database/database-view-client";
import type { DatabaseProperty, RowValue } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ workspaceSlug: string; pageId: string }>;
}): Promise<Metadata> {
  const { workspaceSlug, pageId } = await params;
  const supabase = await createClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("slug", workspaceSlug)
    .maybeSingle();

  if (!workspace) {
    return { title: "Not found" };
  }

  const { data: page } = await supabase
    .from("pages")
    .select("title")
    .eq("id", pageId)
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .maybeSingle();

  return {
    title: page?.title || "Untitled",
  };
}

export default async function PageView({
  params,
}: {
  params: Promise<{ workspaceSlug: string; pageId: string }>;
}) {
  const { workspaceSlug, pageId } = await params;
  const supabase = await createClient();

  // Run auth check and workspace lookup in parallel to reduce waterfall
  const [{ data: authData }, { data: workspace }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("workspaces")
      .select("id, name")
      .eq("slug", workspaceSlug)
      .maybeSingle(),
  ]);

  const user = authData.user;
  if (!user) {
    notFound();
  }

  if (!workspace) {
    notFound();
  }

  // Fetch page and ancestors in parallel
  const [{ data: page }, { data: ancestors }] = await Promise.all([
    supabase
      .from("pages")
      .select("*")
      .eq("id", pageId)
      .eq("workspace_id", workspace.id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase.rpc("get_page_ancestors", { page_id: pageId }),
  ]);

  if (!page) {
    notFound();
  }

  // Detect if this page is a database row (parent is a database page)
  const typedAncestors =
    (ancestors as {
      id: string;
      title: string;
      icon: string | null;
      is_database: boolean;
    }[]) ?? [];

  // The immediate parent is the last ancestor (ordered root-first by the RPC)
  const immediateParent =
    typedAncestors.length > 0
      ? typedAncestors[typedAncestors.length - 1]
      : null;
  const isRowPage =
    !page.is_database &&
    immediateParent !== null &&
    immediateParent.is_database === true;

  // If this is a database row, load the parent database's properties and this row's values
  let rowProperties: DatabaseProperty[] = [];
  const rowValues: Record<string, RowValue> = {};

  if (isRowPage && immediateParent) {
    const [propsResult, valsResult] = await Promise.all([
      supabase
        .from("database_properties")
        .select("*")
        .eq("database_id", immediateParent.id)
        .order("position"),
      supabase
        .from("row_values")
        .select("*")
        .eq("row_id", page.id),
    ]);

    if (!propsResult.error && propsResult.data) {
      rowProperties = propsResult.data as DatabaseProperty[];
    }
    if (!valsResult.error && valsResult.data) {
      for (const val of valsResult.data as RowValue[]) {
        rowValues[val.property_id] = val;
      }
    }
  }

  // Build breadcrumb: workspace → ancestors → current page
  const breadcrumbItems: BreadcrumbItem[] = [
    {
      id: workspace.id,
      title: workspace.name,
      href: `/${workspaceSlug}`,
    },
    ...typedAncestors.map((ancestor) => ({
      id: ancestor.id,
      title: ancestor.title,
      href: `/${workspaceSlug}/${ancestor.id}`,
      isDatabase: ancestor.is_database === true,
    })),
    {
      id: page.id,
      title: page.title,
      href: `/${workspaceSlug}/${page.id}`,
    },
  ];

  // Record page visit (non-blocking — fire and forget so it doesn't delay rendering)
  void supabase
    .from("page_visits")
    .upsert(
      {
        workspace_id: workspace.id,
        user_id: user.id,
        page_id: page.id,
        visited_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,user_id,page_id" },
    )
    .then(({ error }) => {
      if (error && error.code !== "23503") {
        captureSupabaseError(error, "page-view:record-visit");
      }
    });

  void trackEvent("page.viewed", user.id, {
    workspaceId: workspace.id,
    pagePath: `/${workspaceSlug}/${pageId}`,
    metadata: { page_id: page.id },
  });

  // Supabase types jsonb columns as Json | null; narrow to Lexical's serialized state
  const initialContent = page.content as SerializedEditorState | null;
  const isDatabase = page.is_database === true;

  return (
    <div className={`mx-auto p-6 ${isDatabase ? "" : "max-w-3xl"}`}>
      <div className="mb-2">
        <PageBreadcrumb items={breadcrumbItems} />
      </div>
      {isDatabase ? (
        <DatabaseViewClient
          pageId={page.id}
          pageTitle={page.title}
          pageIcon={page.icon ?? null}
          pageCoverUrl={page.cover_url ?? null}
          initialContent={initialContent}
          workspaceId={workspace.id}
          workspaceSlug={workspaceSlug}
          userId={user.id}
        />
      ) : (
        <>
          {isRowPage && rowProperties.length > 0 && (
            <RowPropertiesHeader
              pageId={page.id}
              properties={rowProperties}
              values={rowValues}
              pageCreatedAt={page.created_at}
              pageUpdatedAt={page.updated_at}
              pageCreatedBy={page.created_by}
            />
          )}
          <PageViewClient
            pageId={page.id}
            pageTitle={page.title}
            pageIcon={page.icon ?? null}
            pageCoverUrl={page.cover_url ?? null}
            initialContent={initialContent}
            workspaceId={workspace.id}
            workspaceSlug={workspaceSlug}
            userId={user.id}
          />
        </>
      )}
      <Suspense fallback={null}>
        <PageBacklinks
          pageId={page.id}
          workspaceId={workspace.id}
          workspaceSlug={workspaceSlug}
        />
      </Suspense>
    </div>
  );
}
