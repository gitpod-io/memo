-- Fix page_versions.created_by FK: add ON DELETE SET NULL so that deleting a
-- profile (during account deletion) does not fail with a FK violation.
-- Version history in team workspaces is preserved with created_by = NULL.

-- 1. Allow NULL in created_by (versions are immutable history; a deleted author
--    should not destroy the version record).
alter table public.page_versions
  alter column created_by drop not null;

-- 2. Replace the FK constraint to add ON DELETE SET NULL.
alter table public.page_versions
  drop constraint page_versions_created_by_fkey;

alter table public.page_versions
  add constraint page_versions_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

-- 3. Recreate delete_account to explicitly handle page_versions and other tables
--    added after the original RPC was written (favorites, page_visits,
--    user_feedback, usage_events). While most of these cascade via their FK,
--    being explicit avoids future surprises when new tables are added.
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

  -- Nullify page_versions authored by this user (preserves history in team workspaces)
  update public.page_versions
  set created_by = null
  where created_by = _user_id;

  -- Remove favorites
  delete from public.favorites
  where user_id = _user_id;

  -- Remove page visits
  delete from public.page_visits
  where user_id = _user_id;

  -- Remove user feedback
  delete from public.user_feedback
  where user_id = _user_id;

  -- Remove usage events
  delete from public.usage_events
  where user_id = _user_id;

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
