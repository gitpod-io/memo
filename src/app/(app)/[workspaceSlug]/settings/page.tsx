import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WorkspaceSettingsForm } from "@/components/workspace-settings-form";

export default async function WorkspaceSettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("*")
    .eq("slug", workspaceSlug)
    .maybeSingle();

  if (!workspace) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-xl p-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold">Workspace settings</h1>
        <Link
          href={`/${workspaceSlug}/settings/members`}
          className="text-sm text-accent underline-offset-4 hover:underline"
        >
          Members
        </Link>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage your workspace name, URL, and other settings.
      </p>
      <div className="mt-6">
        <WorkspaceSettingsForm workspace={workspace} userId={user.id} />
      </div>
    </div>
  );
}
