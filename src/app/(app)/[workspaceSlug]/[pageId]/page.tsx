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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("slug", workspaceSlug)
    .maybeSingle();

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
