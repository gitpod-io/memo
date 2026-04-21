-- Favorites: per-user, per-workspace pinned pages for quick sidebar access.

create table favorites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  page_id uuid not null references pages(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id, page_id)
);

-- Index for efficient lookup: all favorites for a user in a workspace
create index favorites_workspace_user on favorites (workspace_id, user_id, created_at);

alter table favorites enable row level security;

create policy "users can read own favorites in their workspaces"
  on favorites for select
  using (
    user_id = auth.uid()
    and is_workspace_member(workspace_id)
  );

create policy "users can insert own favorites in their workspaces"
  on favorites for insert
  with check (
    user_id = auth.uid()
    and is_workspace_member(workspace_id)
  );

create policy "users can delete own favorites"
  on favorites for delete
  using (user_id = auth.uid());
