-- Page version history: stores snapshots of page content for restore.

-- =============================================================================
-- 1. Create page_versions table
-- =============================================================================

create table public.page_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  content jsonb,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id)
);

-- Index for efficient version listing (newest first per page)
create index page_versions_page_id_created_at
  on public.page_versions (page_id, created_at desc);

-- =============================================================================
-- 2. RLS policies
-- =============================================================================

alter table public.page_versions enable row level security;

-- Members can read versions for pages in their workspaces
create policy "members can read page versions"
  on public.page_versions for select
  using (
    exists (
      select 1 from public.pages p
      where p.id = page_versions.page_id
        and is_workspace_member(p.workspace_id)
    )
  );

-- Members can insert versions for pages in their workspaces
create policy "members can insert page versions"
  on public.page_versions for insert
  with check (
    exists (
      select 1 from public.pages p
      where p.id = page_versions.page_id
        and is_workspace_member(p.workspace_id)
    )
    and created_by = auth.uid()
  );

-- No update or delete policies — versions are immutable once created.
-- Pruning is handled by a security definer function.

-- =============================================================================
-- 3. Auto-prune function for versions older than 30 days
-- =============================================================================

create or replace function public.purge_old_page_versions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  _count integer;
begin
  delete from public.page_versions
  where created_at < now() - interval '30 days';

  get diagnostics _count = row_count;
  return _count;
end;
$$;

-- =============================================================================
-- 4. Limit to 50 versions per page (prune oldest beyond 50)
-- =============================================================================

create or replace function public.prune_excess_page_versions(target_page_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  _count integer;
begin
  delete from public.page_versions
  where id in (
    select id from public.page_versions
    where page_id = target_page_id
    order by created_at desc
    offset 50
  );

  get diagnostics _count = row_count;
  return _count;
end;
$$;
