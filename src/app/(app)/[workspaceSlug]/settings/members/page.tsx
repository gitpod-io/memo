import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MembersPage } from "@/components/members/members-page";
import type { MemberWithProfile, WorkspaceInviteWithInviter } from "@/lib/types";

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

  // Fetch all members with profile info.
  // Disambiguate the profiles join: members has two FKs to profiles
  // (user_id and invited_by). We want the user's profile.
  const { data: membersRaw } = await supabase
    .from("members")
    .select("*, profiles!members_user_id_fkey(email, display_name, avatar_url)")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: true });

  // Supabase join returns the relation as an opaque type; cast is unavoidable
  const members = (membersRaw ?? []) as unknown as MemberWithProfile[];

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
    const { data: invites } = await supabase
      .from("workspace_invites")
      .select("*, profiles:invited_by(display_name)")
      .eq("workspace_id", workspace.id)
      .is("accepted_at", null)
      .order("created_at", { ascending: false });

    // Supabase join returns the relation as an opaque type; cast is unavoidable
    pendingInvites = (invites ?? []) as unknown as WorkspaceInviteWithInviter[];
  }

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold">Members</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage who has access to this workspace.
      </p>
      <div className="mt-6">
        <MembersPage
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
