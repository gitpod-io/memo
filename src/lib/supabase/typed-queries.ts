// Typed query helpers for Supabase join queries.
//
// Without generated database types, Supabase returns joined relations as
// `unknown`. These helpers centralize the select strings and type assertions
// so call sites get properly typed results without `as unknown as` casts.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Workspace } from "@/lib/types";

// ---------------------------------------------------------------------------
// Result row types for each join pattern
// ---------------------------------------------------------------------------

/** Row from `members` with joined `profiles` via user_id FK. */
export interface MemberProfileRow {
  user_id: string;
  profiles: {
    id: string;
    display_name: string;
    email: string;
    avatar_url: string | null;
  };
}

/** Row from `members` with joined `profiles(email)` only. */
export interface MemberProfileEmailRow {
  id: string;
  profiles: { email: string } | null;
}

/** Row from `members` with joined full `workspaces(*)`. */
export interface MemberWorkspaceFullRow {
  workspace_id: string;
  workspaces: Workspace;
}

/** Row from `members` with joined `workspaces(slug)`. */
export interface MemberWorkspaceSlugRow {
  workspace_id: string;
  workspaces: { slug: string } | null;
}

/** Row from `members` with joined `workspaces(slug, is_personal)`. */
export interface MemberWorkspaceSlugPersonalRow {
  workspace_id: string;
  workspaces: { slug: string; is_personal: boolean };
}

/** Row from `page_visits` with joined `pages`. */
export interface PageVisitRow {
  page_id: string;
  visited_at: string;
  pages: {
    title: string;
    icon: string | null;
    is_database: boolean;
    deleted_at: string | null;
  };
}

// ---------------------------------------------------------------------------
// Select strings (single source of truth)
// ---------------------------------------------------------------------------

const SELECT_MEMBERS_PROFILES =
  "user_id, profiles!members_user_id_fkey(id, display_name, email, avatar_url)";

const SELECT_MEMBERS_PROFILES_EMAIL =
  "id, profiles!members_user_id_fkey(email)";

const SELECT_MEMBERS_WORKSPACES_ALL = "workspace_id, workspaces(*)";

const SELECT_MEMBERS_WORKSPACES_SLUG = "workspace_id, workspaces(slug)";

const SELECT_MEMBERS_WORKSPACES_SLUG_PERSONAL =
  "workspace_id, workspaces(slug, is_personal)";

const SELECT_PAGE_VISITS_PAGES =
  "page_id, visited_at, pages!inner(title, icon, is_database, deleted_at)";

// ---------------------------------------------------------------------------
// Query builders
//
// Each returns a Supabase query builder with the select string baked in.
// Callers chain `.eq()`, `.limit()`, etc. then cast the result using the
// corresponding row type. The cast is safe because the select string and
// row type are defined together above.
// ---------------------------------------------------------------------------

/** Members with profile info (id, display_name, email, avatar_url). */
export function membersWithProfiles(client: SupabaseClient) {
  return client.from("members").select(SELECT_MEMBERS_PROFILES);
}

/** Members with profile email only (for duplicate-member checks). */
export function membersWithProfileEmail(client: SupabaseClient) {
  return client.from("members").select(SELECT_MEMBERS_PROFILES_EMAIL);
}

/** Members with full workspace data. */
export function membersWithWorkspace(client: SupabaseClient) {
  return client.from("members").select(SELECT_MEMBERS_WORKSPACES_ALL);
}

/** Members with workspace slug only. */
export function membersWithWorkspaceSlug(client: SupabaseClient) {
  return client.from("members").select(SELECT_MEMBERS_WORKSPACES_SLUG);
}

/** Members with workspace slug and is_personal flag. */
export function membersWithWorkspaceSlugPersonal(client: SupabaseClient) {
  return client
    .from("members")
    .select(SELECT_MEMBERS_WORKSPACES_SLUG_PERSONAL);
}

/** Page visits with joined page data (title, icon, is_database). */
export function pageVisitsWithPages(client: SupabaseClient) {
  return client.from("page_visits").select(SELECT_PAGE_VISITS_PAGES);
}

// ---------------------------------------------------------------------------
// Result casting helpers
//
// Supabase without generated types returns join fields as `unknown`.
// These one-liner helpers centralize the cast so call sites stay clean.
// ---------------------------------------------------------------------------

/** Cast a raw members→profiles row array to typed rows. */
export function asMemberProfileRows(
  data: Record<string, unknown>[] | null,
): MemberProfileRow[] {
  return (data ?? []) as unknown as MemberProfileRow[];
}

/** Cast a raw members→profiles(email) row array to typed rows. */
export function asMemberProfileEmailRows(
  data: Record<string, unknown>[] | null,
): MemberProfileEmailRow[] {
  return (data ?? []) as unknown as MemberProfileEmailRow[];
}

/** Cast a raw members→workspaces(*) row array to typed rows. */
export function asMemberWorkspaceFullRows(
  data: Record<string, unknown>[] | null,
): MemberWorkspaceFullRow[] {
  return (data ?? []) as unknown as MemberWorkspaceFullRow[];
}

/** Cast a single raw members→workspaces(slug) row. */
export function asMemberWorkspaceSlugRow(
  data: Record<string, unknown> | null,
): MemberWorkspaceSlugRow | null {
  return data as unknown as MemberWorkspaceSlugRow | null;
}

/** Cast a raw members→workspaces(slug, is_personal) row array. */
export function asMemberWorkspaceSlugPersonalRows(
  data: Record<string, unknown>[] | null,
): MemberWorkspaceSlugPersonalRow[] {
  return (data ?? []) as unknown as MemberWorkspaceSlugPersonalRow[];
}

/** Cast a raw page_visits→pages row array to typed rows. */
export function asPageVisitRows(
  data: Record<string, unknown>[] | null,
): PageVisitRow[] {
  return (data ?? []) as unknown as PageVisitRow[];
}
