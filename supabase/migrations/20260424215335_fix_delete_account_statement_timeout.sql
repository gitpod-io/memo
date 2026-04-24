-- Fix delete_account RPC statement timeout on large workspaces.
--
-- The cascading DELETE FROM pages triggers FK cascades across page_links,
-- page_versions, page_visits, favorites, database_properties, database_views,
-- and row_values. For accounts with 50+ pages this can exceed the default
-- statement_timeout.
--
-- Two changes:
-- 1. SET LOCAL statement_timeout = '60s' — scoped to this transaction only.
-- 2. Explicitly delete from cascade-target tables before deleting pages,
--    reducing the work PostgreSQL must do during the cascade.

create or replace function delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _user_id uuid;
  _sole_owner_names text;
  _personal_workspace_ids uuid[];
begin
  -- Extend timeout for this transaction only. The default statement_timeout
  -- is too short for accounts with many pages and cascading child rows.
  set local statement_timeout = '60s';

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

  -- Collect personal workspace IDs once for reuse
  select array_agg(id) into _personal_workspace_ids
  from public.workspaces
  where created_by = _user_id and is_personal = true;

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

  -- Explicitly delete cascade-target tables for personal workspace pages
  -- before deleting the pages themselves. This avoids a single large cascade
  -- that can exceed statement_timeout on accounts with many pages.
  if _personal_workspace_ids is not null then
    -- Delete row_values for pages in personal workspaces
    delete from public.row_values
    where row_id in (
      select id from public.pages
      where workspace_id = any(_personal_workspace_ids)
    );

    -- Delete database_views for pages in personal workspaces
    delete from public.database_views
    where database_id in (
      select id from public.pages
      where workspace_id = any(_personal_workspace_ids)
    );

    -- Delete database_properties for pages in personal workspaces
    delete from public.database_properties
    where database_id in (
      select id from public.pages
      where workspace_id = any(_personal_workspace_ids)
    );

    -- Delete page_links for pages in personal workspaces
    delete from public.page_links
    where workspace_id = any(_personal_workspace_ids);

    -- Delete page_versions for pages in personal workspaces
    delete from public.page_versions
    where page_id in (
      select id from public.pages
      where workspace_id = any(_personal_workspace_ids)
    );

    -- Delete page_visits for pages in personal workspaces (user's own already
    -- deleted above, but other users may have visited these pages)
    delete from public.page_visits
    where page_id in (
      select id from public.pages
      where workspace_id = any(_personal_workspace_ids)
    );

    -- Delete favorites referencing pages in personal workspaces (user's own
    -- already deleted above, but other users may have favorited these pages)
    delete from public.favorites
    where page_id in (
      select id from public.pages
      where workspace_id = any(_personal_workspace_ids)
    );

    -- Now delete pages — cascade is minimal since child rows are already gone
    delete from public.pages
    where workspace_id = any(_personal_workspace_ids);

    -- Delete personal workspace(s)
    delete from public.workspaces
    where id = any(_personal_workspace_ids);
  end if;

  -- Delete profile
  delete from public.profiles
  where id = _user_id;

  -- Delete auth record (cascades are already handled above explicitly)
  delete from auth.users
  where id = _user_id;
end;
$$;
