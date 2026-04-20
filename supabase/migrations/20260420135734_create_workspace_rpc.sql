-- Atomic workspace creation: inserts workspace + owner member in one call.
-- Fixes RLS chicken-and-egg: the SELECT policy on workspaces requires
-- is_workspace_member(id), but the member row doesn't exist yet when
-- PostgREST tries to return the inserted workspace via RETURNING.
--
-- Uses security definer to bypass RLS for the internal inserts while
-- still enforcing auth, ownership, and the 3-workspace limit.

create or replace function create_workspace(
  workspace_name text,
  workspace_slug text
)
returns table (id uuid, slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  _user_id uuid;
  _count   integer;
  _ws_id   uuid;
begin
  _user_id := auth.uid();
  if _user_id is null then
    raise exception 'Not authenticated'
      using errcode = '28000'; -- invalid_authorization_specification
  end if;

  -- Enforce workspace limit (same as enforce_workspace_limit trigger)
  select count(*) into _count
  from public.workspaces w
  where w.created_by = _user_id;

  if _count >= 3 then
    raise exception 'Workspace limit reached: users can create at most 3 workspaces'
      using errcode = 'P0001';
  end if;

  -- Create workspace
  insert into public.workspaces (name, slug, is_personal, created_by)
  values (workspace_name, workspace_slug, false, _user_id)
  returning public.workspaces.id into _ws_id;

  -- Create owner membership
  insert into public.members (workspace_id, user_id, role, joined_at)
  values (_ws_id, _user_id, 'owner', now());

  return query select _ws_id as id, workspace_slug as slug;
end;
$$;
