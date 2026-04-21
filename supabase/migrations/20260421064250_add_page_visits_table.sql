-- Track page visits per user per workspace for "recently visited" feature.

create table page_visits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  page_id uuid not null references pages(id) on delete cascade,
  visited_at timestamptz not null default now(),
  unique (workspace_id, user_id, page_id)
);

-- Index for the primary query: recent visits per user per workspace.
create index idx_page_visits_user_workspace on page_visits (user_id, workspace_id, visited_at desc);

-- RLS: users can only read/write their own visits.
alter table page_visits enable row level security;

create policy "Users can read own visits"
  on page_visits for select
  using (auth.uid() = user_id);

create policy "Users can insert own visits"
  on page_visits for insert
  with check (auth.uid() = user_id);

create policy "Users can update own visits"
  on page_visits for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);