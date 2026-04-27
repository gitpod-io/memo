import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WorkspaceSettingsForm } from "@/components/workspace-settings-form";
import { ChangePasswordSection } from "@/components/change-password-section";
import { DeleteAccountSection } from "@/components/delete-account-section";
import { Separator } from "@/components/ui/separator";

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

  const workspaceName = workspace?.name ?? workspaceSlug;
  return {
    title: `Settings — ${workspaceName}`,
  };
}

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

  const userEmail = user.email ?? "";

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
      {workspace.is_personal && (
        <>
          <Separator className="mt-8 bg-overlay-border" />
          <div className="mt-8">
            <ChangePasswordSection />
          </div>
          <Separator className="mt-8 bg-overlay-border" />
          <div className="mt-8">
            <DeleteAccountSection userEmail={userEmail} />
          </div>
        </>
      )}
    </div>
  );
}
