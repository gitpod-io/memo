-- Allow workspace creators to add themselves as the owner member.
-- Without this, the "admins can insert members" policy blocks the initial
-- self-insert because the user is not yet a member (chicken-and-egg).

create policy "workspace creators can add themselves as owner"
  on members for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and role = 'owner'
    and exists (
      select 1 from workspaces
      where id = workspace_id and created_by = auth.uid()
    )
  );