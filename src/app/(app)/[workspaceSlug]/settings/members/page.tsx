import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MembersPageClient } from "@/components/members/members-page-client";
import type { WorkspaceInviteWithInviter } from "@/lib/types";
import {
  membersWithFullProfile,
  asMemberWithProfileRows,
  invitesWithInviter,
  asInviteWithInviterRows,
} from "@/lib/supabase/typed-queries";

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
    title: `Members — ${workspaceName}`,
  };
}

export default async function WorkspaceMembersPage({
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

  // Fetch current user's membership to determine their role
  const { data: currentMember } = await supabase
    .from("members")
    .select("id, role")
    .eq("workspace_id", workspace.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!currentMember) {
    notFound();
  }

  // Fetch all members with profile info (email, display_name, avatar_url).
  const { data: membersRaw } = await membersWithFullProfile(supabase)
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: true });

  const members = asMemberWithProfileRows(membersRaw);

  // Extract current user's display name for optimistic invite UI
  const currentUserProfile = members.find((m) => m.user_id === user.id);
  const currentUserDisplayName =
    currentUserProfile?.profiles?.display_name ||
    user.user_metadata?.display_name ||
    "";

  // Fetch pending invites (only visible to admins/owners)
  const isAdmin = currentMember.role === "owner" || currentMember.role === "admin";
  let pendingInvites: WorkspaceInviteWithInviter[] = [];

  if (isAdmin) {
    const { data: invites } = await invitesWithInviter(supabase)
      .eq("workspace_id", workspace.id)
      .is("accepted_at", null)
      .order("created_at", { ascending: false });

    pendingInvites = asInviteWithInviterRows(invites);
  }

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold">Members</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage who has access to this workspace.
      </p>
      <div className="mt-6">
        <MembersPageClient
          workspace={workspace}
          members={members}
          pendingInvites={pendingInvites}
          currentUserId={user.id}
          currentUserRole={currentMember.role}
          currentUserDisplayName={currentUserDisplayName}
        />
      </div>
    </div>
  );
}
