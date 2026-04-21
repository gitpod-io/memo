-- Database views schema: adds is_database to pages, creates database_properties,
-- database_views, and row_values tables with RLS policies.

-- =============================================================================
-- 1. Add is_database column to pages
-- =============================================================================

alter table public.pages
  add column is_database boolean not null default false;

-- =============================================================================
-- 2. database_properties: schema columns for a database page
-- =============================================================================

create table public.database_properties (
  id uuid primary key default gen_random_uuid(),
  database_id uuid not null references public.pages(id) on delete cascade,
  name text not null,
  type text not null check (type in (
    'text', 'number', 'select', 'multi_select', 'checkbox', 'date',
    'url', 'email', 'phone', 'person', 'files', 'relation', 'formula',
    'created_time', 'updated_time', 'created_by'
  )),
  config jsonb not null default '{}',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ordered column listing per database
create index database_properties_db_position
  on public.database_properties (database_id, position);

-- Prevent duplicate column names within a database
create unique index database_properties_db_name
  on public.database_properties (database_id, name);

-- =============================================================================
-- 3. database_views: saved views on a database page
-- =============================================================================

create table public.database_views (
  id uuid primary key default gen_random_uuid(),
  database_id uuid not null references public.pages(id) on delete cascade,
  name text not null default 'Default view',
  type text not null check (type in (
    'table', 'board', 'list', 'calendar', 'gallery'
  )),
  config jsonb not null default '{}',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ordered view tabs per database
create index database_views_db_position
  on public.database_views (database_id, position);

-- =============================================================================
-- 4. row_values: property values for each database row (page)
-- =============================================================================

create table public.row_values (
  id uuid primary key default gen_random_uuid(),
  row_id uuid not null references public.pages(id) on delete cascade,
  property_id uuid not null references public.database_properties(id) on delete cascade,
  value jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One value per row per property
create unique index row_values_row_property
  on public.row_values (row_id, property_id);

-- GIN index on value for filtering queries
create index row_values_value_gin
  on public.row_values using gin (value);

-- =============================================================================
-- 5. Auto-update updated_at triggers
-- =============================================================================

create trigger database_properties_updated_at
  before update on public.database_properties
  for each row
  execute function update_updated_at();

create trigger database_views_updated_at
  before update on public.database_views
  for each row
  execute function update_updated_at();

create trigger row_values_updated_at
  before update on public.row_values
  for each row
  execute function update_updated_at();

-- =============================================================================
-- 6. Row Level Security
-- =============================================================================

alter table public.database_properties enable row level security;
alter table public.database_views enable row level security;
alter table public.row_values enable row level security;

-- ---- database_properties ----
-- Join through pages to verify workspace membership.

create policy "workspace members can read database properties"
  on public.database_properties for select
  using (
    is_workspace_member(
      (select workspace_id from public.pages where id = database_id)
    )
  );

create policy "workspace members can insert database properties"
  on public.database_properties for insert
  with check (
    is_workspace_member(
      (select workspace_id from public.pages where id = database_id)
    )
  );

create policy "workspace members can update database properties"
  on public.database_properties for update
  using (
    is_workspace_member(
      (select workspace_id from public.pages where id = database_id)
    )
  )
  with check (
    is_workspace_member(
      (select workspace_id from public.pages where id = database_id)
    )
  );

create policy "workspace members can delete database properties"
  on public.database_properties for delete
  using (
    is_workspace_member(
      (select workspace_id from public.pages where id = database_id)
    )
  );

-- ---- database_views ----
-- Join through pages to verify workspace membership.

create policy "workspace members can read database views"
  on public.database_views for select
  using (
    is_workspace_member(
      (select workspace_id from public.pages where id = database_id)
    )
  );

create policy "workspace members can insert database views"
  on public.database_views for insert
  with check (
    is_workspace_member(
      (select workspace_id from public.pages where id = database_id)
    )
  );

create policy "workspace members can update database views"
  on public.database_views for update
  using (
    is_workspace_member(
      (select workspace_id from public.pages where id = database_id)
    )
  )
  with check (
    is_workspace_member(
      (select workspace_id from public.pages where id = database_id)
    )
  );

create policy "workspace members can delete database views"
  on public.database_views for delete
  using (
    is_workspace_member(
      (select workspace_id from public.pages where id = database_id)
    )
  );

-- ---- row_values ----
-- Join through pages to verify workspace membership.

create policy "workspace members can read row values"
  on public.row_values for select
  using (
    is_workspace_member(
      (select workspace_id from public.pages where id = row_id)
    )
  );

create policy "workspace members can insert row values"
  on public.row_values for insert
  with check (
    is_workspace_member(
      (select workspace_id from public.pages where id = row_id)
    )
  );

create policy "workspace members can update row values"
  on public.row_values for update
  using (
    is_workspace_member(
      (select workspace_id from public.pages where id = row_id)
    )
  )
  with check (
    is_workspace_member(
      (select workspace_id from public.pages where id = row_id)
    )
  );

create policy "workspace members can delete row values"
  on public.row_values for delete
  using (
    is_workspace_member(
      (select workspace_id from public.pages where id = row_id)
    )
  );
