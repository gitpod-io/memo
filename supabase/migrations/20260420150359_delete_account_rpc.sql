-- Account deletion RPC: deletes the calling user's account in a single
-- transaction. Checks sole-owner constraint first, then cascades through
-- memberships, pages, personal workspaces, profile, and auth record.
--
-- Uses security definer to bypass RLS and access auth.users.

create or replace function delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _user_id uuid;
  _sole_owner_names text;
begin
  _user_id := auth.uid();
  if _user_id is null then
    raise exception 'Not authenticated'
      using errcode = '28000'; -- invalid_authorization_specification
  end if;

  -- Check sole-owner constraint: block deletion if the user is the only
  -- owner of any non-personal workspace.
  select string_agg(w.name, ', ')
  into _sole_owner_names
  from public.members m
  join public.workspaces w on w.id = m.workspace_id
  where m.user_id = _user_id
    and m.role = 'owner'
    and w.is_personal = false
    and not exists (
      select 1 from public.members m2
      where m2.workspace_id = m.workspace_id
        and m2.role = 'owner'
        and m2.user_id <> _user_id
    );

  if _sole_owner_names is not null then
    raise exception 'You are the sole owner of: %. Transfer ownership before deleting your account.',
      _sole_owner_names
      using errcode = 'P0002';
  end if;

  -- Remove membership from all workspaces (non-personal ones stay intact)
  delete from public.members
  where user_id = _user_id;

  -- Delete pages in personal workspace(s)
  delete from public.pages
  where workspace_id in (
    select id from public.workspaces
    where created_by = _user_id and is_personal = true
  );

  -- Delete personal workspace(s)
  delete from public.workspaces
  where created_by = _user_id and is_personal = true;

  -- Delete profile
  delete from public.profiles
  where id = _user_id;

  -- Delete auth record (cascades are already handled above explicitly)
  delete from auth.users
  where id = _user_id;
end;
$$;
