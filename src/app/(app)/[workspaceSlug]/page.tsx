import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const supabase = await createClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, slug")
    .eq("slug", workspaceSlug)
    .maybeSingle();

  if (!workspace) {
    notFound();
  }

  return (
    <div className="flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl space-y-4 text-center">
        <h1 className="text-2xl font-semibold">{workspace.name}</h1>
        <p className="text-sm text-muted-foreground">
          Your workspace is ready. Pages and editor coming soon.
        </p>
      </div>
    </div>
  );
}
