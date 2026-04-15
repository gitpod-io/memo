// Database entity types matching the Supabase schema.

export type MemberRole = "owner" | "admin" | "member";
export type InviteRole = "admin" | "member";

export interface Profile {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  is_personal: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Member {
  id: string;
  workspace_id: string;
  user_id: string;
  role: MemberRole;
  invited_by: string | null;
  invited_at: string | null;
  joined_at: string | null;
  created_at: string;
}

export interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  email: string;
  role: InviteRole;
  invited_by: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

// Joined types for member queries
export interface MemberWithProfile extends Member {
  profiles: Pick<Profile, "email" | "display_name" | "avatar_url">;
}

export interface WorkspaceInviteWithInviter extends WorkspaceInvite {
  profiles: Pick<Profile, "display_name">;
}

export interface Page {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  title: string;
  content: Record<string, unknown> | null;
  icon: string | null;
  position: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}
