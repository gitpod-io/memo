-- Add is_database to get_page_ancestors so breadcrumbs can show the grid icon
-- for database ancestors.
-- Must drop first because the return type changes (new is_database column).

drop function if exists get_page_ancestors(uuid);

create function get_page_ancestors(page_id uuid)
returns table (
  id uuid,
  title text,
  icon text,
  is_database boolean,
  depth integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with recursive ancestors as (
    -- Start from the parent of the given page
    select p.id, p.title, p.icon, p.is_database, p.parent_id, 1 as depth
    from public.pages p
    where p.id = (select parent_id from public.pages where pages.id = page_id)

    union all

    -- Walk up the tree
    select p.id, p.title, p.icon, p.is_database, p.parent_id, a.depth + 1
    from public.pages p
    join ancestors a on p.id = a.parent_id
  )
  select ancestors.id, ancestors.title, ancestors.icon, ancestors.is_database, ancestors.depth
  from ancestors
  order by ancestors.depth desc;  -- root first, immediate parent last
$$;
