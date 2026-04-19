"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Separator } from "@/components/ui/separator";
import { MemberList } from "@/components/members/member-list";
import { InviteForm } from "@/components/members/invite-form";
import { PendingInviteList } from "@/components/members/pending-invite-list";
import type {
  Workspace,
  MemberRole,
  MemberWithProfile,
  WorkspaceInviteWithInviter,
} from "@/lib/types";

interface MembersPageProps {
  workspace: Workspace;
  members: MemberWithProfile[];
  pendingInvites: WorkspaceInviteWithInviter[];
  currentUserId: string;
  currentUserRole: MemberRole;
  currentUserDisplayName: string;
}

export function MembersPage({
  workspace,
  members: initialMembers,
  pendingInvites: initialInvites,
  currentUserId,
  currentUserRole,
  currentUserDisplayName,
}: MembersPageProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [invites, setInvites] = useState(initialInvites);
  const isAdmin = currentUserRole === "owner" || currentUserRole === "admin";

  // Sync local invite state when server data changes (e.g. after sending a new invite)
  useEffect(() => {
    setInvites(initialInvites);
  }, [initialInvites]);

  async function handleRoleChange(memberId: string, newRole: MemberRole) {
    setError(null);
    const supabase = createClient();

    const { error: updateError } = await supabase
      .from("members")
      .update({ role: newRole })
      .eq("id", memberId);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.refresh();
  }

  async function handleRemoveMember(memberId: string) {
    setError(null);
    const supabase = createClient();

    const { error: deleteError } = await supabase
      .from("members")
      .delete()
      .eq("id", memberId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    router.refresh();
  }

  async function handleRevokeInvite(inviteId: string) {
    setError(null);
    const supabase = createClient();

    // Optimistically remove the invite so the UI updates immediately
    setInvites((prev) => prev.filter((i) => i.id !== inviteId));

    const { error: deleteError } = await supabase
      .from("workspace_invites")
      .delete()
      .eq("id", inviteId);

    if (deleteError) {
      // Revert optimistic removal on failure
      setInvites(initialInvites);
      setError(deleteError.message);
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      {isAdmin && (
        <>
          <InviteForm
            workspaceId={workspace.id}
            currentUserId={currentUserId}
            currentUserDisplayName={currentUserDisplayName}
            onInviteSent={(newInvite) => {
              setInvites((prev) => [newInvite, ...prev]);
              router.refresh();
            }}
            onError={setError}
          />
          <Separator className="bg-white/[0.06]" />
        </>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <MemberList
        members={initialMembers}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        isPersonalWorkspace={workspace.is_personal}
        onRoleChange={handleRoleChange}
        onRemove={handleRemoveMember}
      />

      {isAdmin && invites.length > 0 && (
        <>
          <Separator className="bg-white/[0.06]" />
          <PendingInviteList
            invites={invites}
            onRevoke={handleRevokeInvite}
          />
        </>
      )}
    </div>
  );
}
