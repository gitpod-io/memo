import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/page-title";
import { Editor } from "@/components/editor/editor";
import type { SerializedEditorState } from "lexical";

export default async function PageView({
  params,
}: {
  params: Promise<{ workspaceSlug: string; pageId: string }>;
}) {
  const { workspaceSlug, pageId } = await params;
  const supabase = await createClient();

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

  const initialContent = page.content as SerializedEditorState | null;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <PageTitle key={page.id} pageId={page.id} initialTitle={page.title} />
      <div className="mt-4">
        <Editor
          key={page.id}
          pageId={page.id}
          initialContent={initialContent}
        />
      </div>
    </div>
  );
}
