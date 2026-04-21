-- Repair: the original migration (20260421062334_add_favorites_table.sql) was
-- deployed empty before being populated. Any database that applied the empty
-- version has it marked as "applied" but the table does not exist. This
-- idempotent migration creates the table only if it is missing.

create table if not exists favorites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  page_id uuid not null references pages(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id, page_id)
);

-- Index (IF NOT EXISTS requires PG 9.5+, which Supabase satisfies)
create index if not exists favorites_workspace_user
  on favorites (workspace_id, user_id, created_at);

-- Enable RLS (idempotent — no-op if already enabled)
alter table favorites enable row level security;

-- Policies: use DO blocks to skip creation if they already exist.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'favorites'
      and policyname = 'users can read own favorites in their workspaces'
  ) then
    create policy "users can read own favorites in their workspaces"
      on favorites for select
      using (
        user_id = auth.uid()
        and is_workspace_member(workspace_id)
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'favorites'
      and policyname = 'users can insert own favorites in their workspaces'
  ) then
    create policy "users can insert own favorites in their workspaces"
      on favorites for insert
      with check (
        user_id = auth.uid()
        and is_workspace_member(workspace_id)
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'favorites'
      and policyname = 'users can delete own favorites'
  ) then
    create policy "users can delete own favorites"
      on favorites for delete
      using (user_id = auth.uid());
  end if;
end $$;
