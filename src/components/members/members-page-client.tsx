"use client";

import dynamic from "next/dynamic";
import type {
  Workspace,
  MemberRole,
  MemberWithProfile,
  WorkspaceInviteWithInviter,
} from "@/lib/types";

const MembersPage = dynamic(
  () =>
    import("@/components/members/members-page").then(
      (mod) => mod.MembersPage,
    ),
);

interface MembersPageClientProps {
  workspace: Workspace;
  members: MemberWithProfile[];
  pendingInvites: WorkspaceInviteWithInviter[];
  currentUserId: string;
  currentUserRole: MemberRole;
  currentUserDisplayName: string;
}

export function MembersPageClient(props: MembersPageClientProps) {
  return <MembersPage {...props} />;
}
