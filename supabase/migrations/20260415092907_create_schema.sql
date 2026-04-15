-- Memo foundational schema: profiles, workspaces, members, workspace_invites, pages
-- Includes RLS policies, handle_new_user trigger, and workspace creation limit trigger.

-- =============================================================================
-- 1. Custom types
-- =============================================================================

create type member_role as enum ('owner', 'admin', 'member');
create type invite_role as enum ('admin', 'member');

-- =============================================================================
-- 2. Tables
-- =============================================================================

-- profiles: 1:1 with auth.users, created by handle_new_user trigger
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);

-- workspaces: personal + team workspaces
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_personal boolean not null default false,
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One personal workspace per user
create unique index workspaces_one_personal_per_user
  on workspaces (created_by) where is_personal = true;

-- members: workspace membership with roles
create table members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role member_role not null default 'member',
  invited_by uuid references profiles(id) on delete set null,
  invited_at timestamptz,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

-- workspace_invites: email-based invitations with token
create table workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email text not null,
  role invite_role not null default 'member',
  invited_by uuid not null references profiles(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- pages: nested pages with Lexical JSON content
create table pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  parent_id uuid references pages(id) on delete cascade,
  title text not null default '',
  content jsonb,
  icon text,
  position integer not null default 0,
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for efficient page tree queries (children of a parent within a workspace)
create index pages_workspace_parent on pages (workspace_id, parent_id, position);

-- =============================================================================
-- 3. Row Level Security
-- =============================================================================

alter table profiles enable row level security;
alter table workspaces enable row level security;
alter table members enable row level security;
alter table workspace_invites enable row level security;
alter table pages enable row level security;

-- Helper: check if the current user is a member of a workspace
create or replace function is_workspace_member(ws_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.members
    where workspace_id = ws_id and user_id = auth.uid()
  );
$$;

-- Helper: check if the current user is an owner or admin of a workspace
create or replace function is_workspace_admin(ws_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.members
    where workspace_id = ws_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

-- ---- profiles ----

create policy "users can read own profile"
  on profiles for select
  using (id = auth.uid());

create policy "users can read profiles of co-members"
  on profiles for select
  using (
    id in (
      select m.user_id from members m
      where m.workspace_id in (
        select m2.workspace_id from members m2 where m2.user_id = auth.uid()
      )
    )
  );

create policy "users can update own profile"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- profiles are created by the handle_new_user trigger (security definer),
-- so no INSERT policy is needed for regular users.

-- ---- workspaces ----

create policy "members can read their workspaces"
  on workspaces for select
  using (is_workspace_member(id));

create policy "authenticated users can create workspaces"
  on workspaces for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "admins can update their workspaces"
  on workspaces for update
  using (is_workspace_admin(id))
  with check (is_workspace_admin(id));

-- Prevent deletion of personal workspaces
create policy "admins can delete non-personal workspaces"
  on workspaces for delete
  using (is_workspace_admin(id) and is_personal = false);

-- ---- members ----

create policy "members can read workspace members"
  on members for select
  using (is_workspace_member(workspace_id));

create policy "admins can insert members"
  on members for insert
  to authenticated
  with check (is_workspace_admin(workspace_id));

create policy "admins can update members"
  on members for update
  using (is_workspace_admin(workspace_id))
  with check (is_workspace_admin(workspace_id));

create policy "admins can delete members"
  on members for delete
  using (is_workspace_admin(workspace_id));

-- ---- workspace_invites ----

create policy "admins can read invites"
  on workspace_invites for select
  using (is_workspace_admin(workspace_id));

create policy "admins can create invites"
  on workspace_invites for insert
  to authenticated
  with check (is_workspace_admin(workspace_id));

create policy "admins can update invites"
  on workspace_invites for update
  using (is_workspace_admin(workspace_id))
  with check (is_workspace_admin(workspace_id));

create policy "admins can delete invites"
  on workspace_invites for delete
  using (is_workspace_admin(workspace_id));

-- Invited users can read their own invite (for the accept flow)
create policy "invited users can read own invite by email"
  on workspace_invites for select
  using (lower(email) = lower(auth.jwt() ->> 'email'));

-- ---- pages ----

create policy "members can read pages"
  on pages for select
  using (is_workspace_member(workspace_id));

create policy "members can create pages"
  on pages for insert
  to authenticated
  with check (is_workspace_member(workspace_id) and created_by = auth.uid());

create policy "members can update pages"
  on pages for update
  using (is_workspace_member(workspace_id))
  with check (is_workspace_member(workspace_id));

create policy "members can delete pages"
  on pages for delete
  using (is_workspace_member(workspace_id));

-- =============================================================================
-- 4. Triggers
-- =============================================================================

-- ---- handle_new_user: creates profile + personal workspace + owner membership ----

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _display_name text;
  _email text;
  _workspace_id uuid;
  _slug text;
begin
  _email := new.email;
  _display_name := coalesce(
    new.raw_user_meta_data ->> 'display_name',
    split_part(_email, '@', 1)
  );

  -- Create profile
  insert into public.profiles (id, email, display_name)
  values (new.id, _email, _display_name);

  -- Generate a unique slug from the display name
  _slug := lower(regexp_replace(_display_name, '[^a-zA-Z0-9]', '-', 'g'));
  _slug := regexp_replace(_slug, '-+', '-', 'g');
  _slug := trim(both '-' from _slug);
  -- Append a random suffix to ensure uniqueness
  _slug := _slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  -- Create personal workspace
  insert into public.workspaces (id, name, slug, is_personal, created_by)
  values (
    gen_random_uuid(),
    _display_name || '''s Workspace',
    _slug,
    true,
    new.id
  )
  returning id into _workspace_id;

  -- Create owner membership
  insert into public.members (workspace_id, user_id, role, joined_at)
  values (_workspace_id, new.id, 'owner', now());

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function handle_new_user();

-- ---- Workspace creation limit: max 3 per user ----

create or replace function enforce_workspace_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _count integer;
begin
  select count(*) into _count
  from public.workspaces
  where created_by = new.created_by;

  if _count >= 3 then
    raise exception 'Workspace limit reached: users can create at most 3 workspaces'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger enforce_workspace_limit_trigger
  before insert on workspaces
  for each row
  execute function enforce_workspace_limit();

-- ---- Auto-update updated_at on workspaces and pages ----

create or replace function update_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger workspaces_updated_at
  before update on workspaces
  for each row
  execute function update_updated_at();

create trigger pages_updated_at
  before update on pages
  for each row
  execute function update_updated_at();
