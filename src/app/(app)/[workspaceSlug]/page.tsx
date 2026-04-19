import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WorkspaceHome } from "@/components/workspace-home";

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

  const { data: pages } = await supabase
    .from("pages")
    .select("id, title, parent_id, position, icon, updated_at")
    .eq("workspace_id", workspace.id)
    .is("parent_id", null)
    .order("position", { ascending: true });

  return (
    <WorkspaceHome
      workspace={workspace}
      pages={pages ?? []}
      userId={user?.id ?? ""}
    />
  );
}
