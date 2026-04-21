-- page_links: junction table tracking which pages link to which other pages.
-- Populated by application logic on auto-save (diffing PageLinkNode entries).

create table page_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  source_page_id uuid not null references pages(id) on delete cascade,
  target_page_id uuid not null references pages(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (source_page_id, target_page_id)
);

-- Index for backlinks query: find all pages that link to a given page.
create index page_links_target on page_links (target_page_id, workspace_id);

-- Index for forward links query: find all links from a given page.
create index page_links_source on page_links (source_page_id);

alter table page_links enable row level security;

-- Workspace members can read all links in their workspace.
create policy "workspace members can read page links"
  on page_links for select
  using (is_workspace_member(workspace_id));

-- Workspace members can insert links in their workspace.
create policy "workspace members can insert page links"
  on page_links for insert
  with check (is_workspace_member(workspace_id));

-- Workspace members can delete links in their workspace.
create policy "workspace members can delete page links"
  on page_links for delete
  using (is_workspace_member(workspace_id));
