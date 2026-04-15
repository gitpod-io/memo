-- Full-text search on pages: extract text from Lexical JSON, build tsvector, index with GIN.

-- =============================================================================
-- 1. Function to extract plain text from Lexical editor JSON
-- =============================================================================
-- Lexical stores content as a tree of nodes. Text lives in nodes with
-- type = "text" under a "text" key. This function recursively walks the
-- JSON tree and concatenates all text values separated by spaces.

create or replace function extract_text_from_lexical(content jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  result text := '';
  child jsonb;
  children jsonb;
begin
  if content is null then
    return '';
  end if;

  -- If this node has a "text" key and type "text", grab it
  if content ->> 'type' = 'text' and content ? 'text' then
    result := result || ' ' || (content ->> 'text');
  end if;

  -- Recurse into "children" array
  children := content -> 'children';
  if children is not null and jsonb_typeof(children) = 'array' then
    for child in select jsonb_array_elements(children)
    loop
      result := result || extract_text_from_lexical(child);
    end loop;
  end if;

  -- Lexical wraps content in { root: { children: [...] } }
  -- Handle the root wrapper
  if content ? 'root' then
    result := result || extract_text_from_lexical(content -> 'root');
  end if;

  return result;
end;
$$;

-- =============================================================================
-- 2. Function to build the search vector for a page
-- =============================================================================
-- Title gets weight A (highest), content text gets weight B.

create or replace function page_search_vector(title text, content jsonb)
returns tsvector
language plpgsql
immutable
set search_path = ''
as $$
begin
  return (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(extract_text_from_lexical(content), '')), 'B')
  );
end;
$$;

-- =============================================================================
-- 3. Generated column on pages table
-- =============================================================================

alter table pages
  add column search_vector tsvector
  generated always as (page_search_vector(title, content)) stored;

-- =============================================================================
-- 4. GIN index for fast full-text search
-- =============================================================================

create index pages_search_idx on pages using gin (search_vector);

-- =============================================================================
-- 5. Search function — called via supabase.rpc('search_pages', ...)
-- =============================================================================
-- Returns matching pages within a workspace, ranked by relevance.
-- Includes a text snippet from the content for display in search results.

create or replace function search_pages(
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
  -- Convert the user query to a tsquery, handling multi-word input
  -- plainto_tsquery handles plain text without requiring special syntax
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
        coalesce(p.title, '') || ' ' || coalesce(extract_text_from_lexical(p.content), ''),
        tsquery_val,
        'StartSel=<<, StopSel=>>, MaxWords=35, MinWords=15, MaxFragments=1'
      ) as snippet,
      ts_rank(p.search_vector, tsquery_val) as rank
    from public.pages p
    where p.workspace_id = ws_id
      and p.search_vector @@ tsquery_val
    order by rank desc
    limit result_limit;
end;
$$;
