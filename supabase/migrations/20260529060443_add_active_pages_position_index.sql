-- Optimise the sidebar pages query which filters on workspace_id,
-- deleted_at IS NULL and orders by position.  The existing
-- pages_workspace_parent index (workspace_id, parent_id, position) does not
-- cover this access pattern because parent_id is not in the WHERE clause.
-- The pages_workspace_deleted_at partial index only covers trashed rows
-- (WHERE deleted_at IS NOT NULL).

create index concurrently if not exists pages_workspace_active_position
  on public.pages (workspace_id, position)
  where deleted_at is null;
