import type { Metadata } from "next";
import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/server";
import { captureSupabaseError } from "@/lib/sentry";
import type { SerializedEditorState } from "lexical";
import {
  PageBreadcrumb,
  type BreadcrumbItem,
} from "@/components/page-breadcrumb";

const PageViewClient = dynamic(
  () =>
    import("@/components/page-view-client").then((mod) => mod.PageViewClient),
  {
    loading: () => (
      <>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="h-9 w-1/3 animate-pulse bg-muted" />
          </div>
          <div className="h-8 w-8 animate-pulse bg-muted" />
        </div>
        <div className="mt-4 space-y-3">
          <div className="h-4 w-full animate-pulse bg-muted" />
          <div className="h-4 w-5/6 animate-pulse bg-muted" />
          <div className="h-4 w-4/6 animate-pulse bg-muted" />
        </div>
      </>
    ),
  },
);

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

  // Build breadcrumb: workspace → ancestors → current page
  const breadcrumbItems: BreadcrumbItem[] = [
    {
      id: workspace.id,
      title: workspace.name,
      href: `/${workspaceSlug}`,
    },
    ...((ancestors as { id: string; title: string; icon: string | null }[]) ?? []).map(
      (ancestor) => ({
        id: ancestor.id,
        title: ancestor.title,
        href: `/${workspaceSlug}/${ancestor.id}`,
      }),
    ),
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

  // Supabase types jsonb columns as Json | null; narrow to Lexical's serialized state
  const initialContent = page.content as SerializedEditorState | null;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-2">
        <PageBreadcrumb items={breadcrumbItems} />
      </div>
      <PageViewClient
        pageId={page.id}
        pageTitle={page.title}
        pageIcon={page.icon ?? null}
        initialContent={initialContent}
        workspaceId={workspace.id}
        workspaceSlug={workspaceSlug}
        userId={user.id}
      />
    </div>
  );
}
