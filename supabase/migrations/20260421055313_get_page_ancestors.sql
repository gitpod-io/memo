-- Returns the ancestor chain for a page, from the immediate parent up to the root.
-- Each row includes id, title, icon, and depth (1 = immediate parent, 2 = grandparent, etc.).
-- The current page is NOT included in the result.
-- Respects RLS: only returns ancestors the caller can see (workspace membership).

create or replace function get_page_ancestors(page_id uuid)
returns table (
  id uuid,
  title text,
  icon text,
  depth integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with recursive ancestors as (
    -- Start from the parent of the given page
    select p.id, p.title, p.icon, p.parent_id, 1 as depth
    from public.pages p
    where p.id = (select parent_id from public.pages where pages.id = page_id)

    union all

    -- Walk up the tree
    select p.id, p.title, p.icon, p.parent_id, a.depth + 1
    from public.pages p
    join ancestors a on p.id = a.parent_id
  )
  select ancestors.id, ancestors.title, ancestors.icon, ancestors.depth
  from ancestors
  order by ancestors.depth desc;  -- root first, immediate parent last
$$;
