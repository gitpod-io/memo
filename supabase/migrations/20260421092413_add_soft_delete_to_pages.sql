-- Soft-delete support for pages: adds deleted_at column, updates RLS policies
-- and search to exclude trashed pages, adds trash management RPCs.

-- =============================================================================
-- 1. Add deleted_at column
-- =============================================================================

alter table public.pages
  add column deleted_at timestamptz;

-- Index for efficient trash queries (non-null deleted_at within a workspace)
create index pages_workspace_deleted_at
  on public.pages (workspace_id, deleted_at)
  where deleted_at is not null;

-- =============================================================================
-- 2. Update RLS policies to exclude trashed pages from normal queries
-- =============================================================================

-- Drop existing page policies and recreate with deleted_at filter
drop policy if exists "members can read pages" on public.pages;
drop policy if exists "members can update pages" on public.pages;
drop policy if exists "members can delete pages" on public.pages;

-- Normal reads exclude trashed pages
create policy "members can read active pages"
  on public.pages for select
  using (is_workspace_member(workspace_id) and deleted_at is null);

-- Trash reads: members can see their workspace's trashed pages
create policy "members can read trashed pages"
  on public.pages for select
  using (is_workspace_member(workspace_id) and deleted_at is not null);

-- Members can update any page in their workspace (active or trashed).
-- Soft-delete sets deleted_at, restore clears it — both need UPDATE access.
create policy "members can update pages"
  on public.pages for update
  using (is_workspace_member(workspace_id))
  with check (is_workspace_member(workspace_id));

-- Hard delete only allowed on trashed pages (from trash UI)
create policy "members can delete trashed pages"
  on public.pages for delete
  using (is_workspace_member(workspace_id) and deleted_at is not null);

-- =============================================================================
-- 3. Update search_pages to exclude trashed pages
-- =============================================================================

create or replace function public.search_pages(
  query text,
  ws_id uuid,
  result_limit integer default 20
)
returns table (
  id uuid,
  workspace_id uuid,
  parent_id uuid,
  title text,
  icon text,
  snippet text,
  rank real
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  tsquery_val tsquery;
begin
  if not exists (
    select 1 from public.members m
    where m.workspace_id = ws_id
      and m.user_id = auth.uid()
  ) then
    raise exception 'Not a member of this workspace'
      using errcode = '42501';
  end if;

  tsquery_val := plainto_tsquery('english', query);

  return query
    select
      p.id,
      p.workspace_id,
      p.parent_id,
      p.title,
      p.icon,
      ts_headline(
        'english',
        coalesce(p.title, '') || ' ' || coalesce(public.extract_text_from_lexical(p.content), ''),
        tsquery_val,
        'StartSel=<<, StopSel=>>, MaxWords=35, MinWords=15, MaxFragments=1'
      ) as snippet,
      ts_rank(p.search_vector, tsquery_val) as rank
    from public.pages p
    where p.workspace_id = ws_id
      and p.search_vector @@ tsquery_val
      and p.deleted_at is null
    order by rank desc
    limit result_limit;
end;
$$;

-- =============================================================================
-- 4. Soft-delete RPC: moves a page and its descendants to trash
-- =============================================================================

create or replace function public.soft_delete_page(page_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  _now timestamptz := now();
begin
  -- Mark the page and all its descendants as deleted using a recursive CTE
  with recursive descendants as (
    select id from public.pages where id = page_id and deleted_at is null
    union all
    select p.id from public.pages p
    inner join descendants d on p.parent_id = d.id
    where p.deleted_at is null
  )
  update public.pages
  set deleted_at = _now
  where id in (select id from descendants);
end;
$$;

-- =============================================================================
-- 5. Restore RPC: restores a page and its descendants from trash
-- =============================================================================

create or replace function public.restore_page(page_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  _parent_id uuid;
  _parent_deleted boolean;
begin
  -- Get the parent of the page being restored
  select parent_id into _parent_id
  from public.pages
  where id = page_id;

  -- Check if the parent is also deleted (or doesn't exist)
  if _parent_id is not null then
    select (deleted_at is not null) into _parent_deleted
    from public.pages
    where id = _parent_id;

    -- If parent is deleted, move this page to root level
    if _parent_deleted then
      update public.pages
      set parent_id = null
      where id = page_id;
    end if;
  end if;

  -- Restore the page and all its descendants
  with recursive descendants as (
    select id from public.pages where id = page_id
    union all
    select p.id from public.pages p
    inner join descendants d on p.parent_id = d.id
    where p.deleted_at is not null
  )
  update public.pages
  set deleted_at = null
  where id in (select id from descendants);
end;
$$;

-- =============================================================================
-- 6. Empty trash RPC: permanently deletes all trashed pages in a workspace
-- =============================================================================

create or replace function public.empty_trash(ws_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.pages
  where workspace_id = ws_id
    and deleted_at is not null;
end;
$$;

-- =============================================================================
-- 7. Auto-purge function for pages trashed > 30 days
-- =============================================================================
-- This can be called by pg_cron or a scheduled Edge Function.

create or replace function public.purge_old_trash()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  _count integer;
begin
  delete from public.pages
  where deleted_at is not null
    and deleted_at < now() - interval '30 days';

  get diagnostics _count = row_count;
  return _count;
end;
$$;
