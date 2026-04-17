import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageViewClient } from "@/components/page-view-client";
import type { SerializedEditorState } from "lexical";

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
      .select("id")
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

  const { data: page } = await supabase
    .from("pages")
    .select("*")
    .eq("id", pageId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (!page) {
    notFound();
  }

  // Supabase types jsonb columns as Json | null; narrow to Lexical's serialized state
  const initialContent = page.content as SerializedEditorState | null;

  return (
    <PageViewClient
      pageId={page.id}
      pageTitle={page.title}
      initialContent={initialContent}
      workspaceId={workspace.id}
      workspaceSlug={workspaceSlug}
      userId={user.id}
    />
  );
}
