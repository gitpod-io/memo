import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WorkspaceHomeClient } from "@/components/workspace-home-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}): Promise<Metadata> {
  const { workspaceSlug } = await params;
  const supabase = await createClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("name")
    .eq("slug", workspaceSlug)
    .maybeSingle();

  return {
    title: workspace?.name ?? workspaceSlug,
  };
}

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, slug")
    .eq("slug", workspaceSlug)
    .maybeSingle();

  if (!workspace) {
    notFound();
  }

  const userId = user?.id ?? "";

  // Fetch pages and recent visits in parallel.
  // Root-level pages (parent_id IS NULL) include both regular pages and databases.
  // Database rows are children of database pages, so they're excluded by the
  // parent_id filter. We also fetch is_database so the UI can show the grid icon.
  const [{ data: pages }, { data: recentVisitRows }] = await Promise.all([
    supabase
      .from("pages")
      .select("id, title, parent_id, position, icon, is_database, created_at, updated_at")
      .eq("workspace_id", workspace.id)
      .is("parent_id", null)
      .is("deleted_at", null)
      .order("position", { ascending: true }),
    supabase
      .from("page_visits")
      .select("page_id, visited_at, pages!inner(title, icon, is_database, deleted_at)")
      .eq("workspace_id", workspace.id)
      .eq("user_id", userId)
      .is("pages.deleted_at", null)
      .order("visited_at", { ascending: false })
      .limit(5),
  ]);

  // Normalize the joined rows into a flat shape
  const recentVisits = (recentVisitRows ?? []).map((row) => {
    const page = row.pages as unknown as { title: string; icon: string | null; is_database: boolean };
    return {
      page_id: row.page_id as string,
      visited_at: row.visited_at as string,
      title: page.title,
      icon: page.icon,
      is_database: page.is_database ?? false,
    };
  });

  return (
    <WorkspaceHomeClient
      workspace={workspace}
      pages={pages ?? []}
      userId={userId}
      recentVisits={recentVisits}
    />
  );
}
