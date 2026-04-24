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
  cover_url: string | null;
  is_database: boolean;
  position: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Page without the content column — used by the sidebar tree to reduce payload. */
export type SidebarPage = Omit<Page, "content">;

export interface PageVisit {
  id: string;
  workspace_id: string;
  user_id: string;
  page_id: string;
  visited_at: string;
}

// Joined type for recent visits query (page_visits joined with pages)
export interface RecentPageVisit {
  page_id: string;
  visited_at: string;
  title: string;
  icon: string | null;
  is_database: boolean;
}

export interface Favorite {
  id: string;
  workspace_id: string;
  user_id: string;
  page_id: string;
  created_at: string;
}

// Joined type for displaying favorites with page info
export interface FavoriteWithPage extends Favorite {
  pages: Pick<Page, "id" | "title" | "icon" | "is_database">;
}

export interface PageVersion {
  id: string;
  page_id: string;
  content: Record<string, unknown> | null;
  created_at: string;
  created_by: string | null;
}

export interface PageLink {
  id: string;
  workspace_id: string;
  source_page_id: string;
  target_page_id: string;
  created_at: string;
}

// Joined type for backlinks query (page_links joined with source page)
export interface BacklinkWithPage extends PageLink {
  source_page: Pick<Page, "id" | "title" | "icon">;
}

// Database views types

export type PropertyType =
  | "text"
  | "number"
  | "select"
  | "multi_select"
  | "status"
  | "checkbox"
  | "date"
  | "url"
  | "email"
  | "phone"
  | "person"
  | "files"
  | "relation"
  | "formula"
  | "created_time"
  | "updated_time"
  | "created_by";

export type DatabaseViewType =
  | "table"
  | "board"
  | "list"
  | "calendar"
  | "gallery";

export interface SelectOption {
  id: string;
  name: string;
  color: string;
}

export interface DatabaseProperty {
  id: string;
  database_id: string;
  name: string;
  type: PropertyType;
  config: Record<string, unknown>;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface DatabaseViewConfig {
  visible_properties?: string[];
  sorts?: { property_id: string; direction: "asc" | "desc" }[];
  filters?: {
    property_id: string;
    operator: string;
    value: unknown;
  }[];
  // Table-specific
  column_widths?: Record<string, number>;
  row_height?: "compact" | "default" | "tall";
  // Board-specific
  group_by?: string;
  hide_empty_groups?: boolean;
  // Calendar-specific
  date_property?: string;
  // Gallery-specific
  card_size?: "small" | "medium" | "large";
  cover_property?: string | null;
}

export interface DatabaseView {
  id: string;
  database_id: string;
  name: string;
  type: DatabaseViewType;
  config: DatabaseViewConfig;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface RowValue {
  id: string;
  row_id: string;
  property_id: string;
  value: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Joined type for loading a database row with all its property values
export interface DatabaseRow {
  page: Pick<Page, "id" | "title" | "icon" | "cover_url" | "created_at" | "updated_at" | "created_by">;
  values: Record<string, RowValue>; // keyed by property_id
}

export type FeedbackType = "bug" | "feature" | "general";
export type FeedbackStatus = "new" | "reviewed" | "actioned" | "dismissed";

export interface UserFeedback {
  id: string;
  user_id: string;
  type: FeedbackType;
  message: string;
  page_path: string | null;
  page_title: string | null;
  screenshot_url: string | null;
  metadata: Record<string, unknown> | null;
  status: FeedbackStatus;
  created_at: string;
}

export interface UsageEvent {
  id: string;
  event_name: string;
  user_id: string;
  workspace_id: string | null;
  page_path: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}
