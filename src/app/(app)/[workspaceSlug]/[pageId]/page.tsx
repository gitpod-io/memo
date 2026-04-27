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
import { PageContentClient } from "@/components/page-content-client";
import type {
  DatabaseProperty,
  DatabaseRow,
  DatabaseView,
  RowValue,
} from "@/lib/types";
import type { LoadDatabaseResult } from "@/lib/database";

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

  // Pre-fetch database data on the server so DatabaseViewClient can render
  // immediately without a client-side loading skeleton (#682)
  let initialDatabaseData: LoadDatabaseResult | null = null;
  if (isDatabase) {
    const [propertiesResult, viewsResult, rowsResult] = await Promise.all([
      supabase
        .from("database_properties")
        .select("*")
        .eq("database_id", page.id)
        .order("position"),
      supabase
        .from("database_views")
        .select("*")
        .eq("database_id", page.id)
        .order("position"),
      supabase
        .from("pages")
        .select(
          "id, title, icon, cover_url, created_at, updated_at, created_by",
        )
        .eq("parent_id", page.id)
        .is("deleted_at", null)
        .order("position"),
    ]);

    if (
      propertiesResult.error ||
      viewsResult.error ||
      rowsResult.error
    ) {
      if (propertiesResult.error) captureSupabaseError(propertiesResult.error, "page.prefetch:properties");
      if (viewsResult.error) captureSupabaseError(viewsResult.error, "page.prefetch:views");
      if (rowsResult.error) captureSupabaseError(rowsResult.error, "page.prefetch:rows");
    } else {
      const properties = propertiesResult.data as DatabaseProperty[];
      const views = viewsResult.data as DatabaseView[];
      const rowPages = rowsResult.data as {
        id: string;
        title: string;
        icon: string | null;
        cover_url: string | null;
        created_at: string;
        updated_at: string;
        created_by: string;
      }[];

      // Load row values in a single query
      const rowIds = rowPages.map((r) => r.id);
      let allValues: RowValue[] = [];
      if (rowIds.length > 0) {
        const { data: valuesData, error: valuesError } = await supabase
          .from("row_values")
          .select("*")
          .in("row_id", rowIds);
        if (valuesError) {
          captureSupabaseError(valuesError, "page.prefetch:values");
        } else if (valuesData) {
          allValues = valuesData as RowValue[];
        }
      }

      // Group values by row_id, keyed by property_id
      const valuesByRow = new Map<string, Record<string, RowValue>>();
      for (const val of allValues) {
        let rowMap = valuesByRow.get(val.row_id);
        if (!rowMap) {
          rowMap = {};
          valuesByRow.set(val.row_id, rowMap);
        }
        rowMap[val.property_id] = val;
      }

      const rows: DatabaseRow[] = rowPages.map((rp) => ({
        page: rp,
        values: valuesByRow.get(rp.id) ?? {},
      }));

      // Enrich person/created_by properties with workspace members
      const { data: membersData } = await supabase
        .from("members")
        .select(
          "user_id, profiles!members_user_id_fkey(id, display_name, email, avatar_url)",
        )
        .eq("workspace_id", workspace.id);

      const members = (membersData ?? []).map((m) => {
        const profile = m.profiles as unknown as {
          id: string;
          display_name: string;
          email: string;
          avatar_url: string | null;
        };
        return {
          id: m.user_id,
          display_name: profile.display_name,
          email: profile.email,
          avatar_url: profile.avatar_url,
        };
      });

      const enrichedProperties = properties.map((prop) => {
        if (prop.type === "person" || prop.type === "created_by") {
          return { ...prop, config: { ...prop.config, _members: members } };
        }
        return prop;
      });

      initialDatabaseData = {
        properties: enrichedProperties,
        views,
        rows,
      };
    }
  }

  return (
    <div className={`mx-auto p-6 ${isDatabase ? "" : "max-w-3xl"}`}>
      <div className="mb-2">
        <PageBreadcrumb items={breadcrumbItems} />
      </div>
      <PageContentClient
        pageId={page.id}
        pageTitle={page.title}
        pageIcon={page.icon ?? null}
        pageCoverUrl={page.cover_url ?? null}
        initialContent={initialContent}
        workspaceId={workspace.id}
        workspaceSlug={workspaceSlug}
        userId={user.id}
        isDatabase={isDatabase}
        isRowPage={isRowPage}
        rowProperties={rowProperties}
        rowValues={rowValues}
        pageCreatedAt={page.created_at}
        pageUpdatedAt={page.updated_at}
        pageCreatedBy={page.created_by}
        initialDatabaseData={initialDatabaseData}
      />
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
