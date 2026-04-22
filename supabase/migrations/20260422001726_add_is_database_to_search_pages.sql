-- Add is_database to search_pages return type so search results can show
-- the grid icon for database pages.
-- Must drop first because the return type changes.

drop function if exists public.search_pages(text, uuid, integer);

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
  is_database boolean,
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
      p.is_database,
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
