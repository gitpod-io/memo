-- Additional RLS policies for the workspace members invite/accept flow.
-- The base tables and core policies exist in 20260415092907_create_schema.sql.

-- Allow any authenticated user to read an invite by its token.
-- Needed for the /invite/[token] accept page where the user
-- may not be the admin but is the invitee.
create policy "authenticated users can read invite by token"
  on workspace_invites for select
  to authenticated
  using (true);

-- Allow invited users to mark their own invite as accepted.
-- Matches on email (case-insensitive) and only allows updating unaccepted invites.
create policy "invited users can accept their invite"
  on workspace_invites for update
  to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email') and accepted_at is null)
  with check (lower(email) = lower(auth.jwt() ->> 'email'));

-- Allow users to insert themselves as a member when accepting an invite.
-- Verifies a valid, unexpired, unaccepted invite exists for their email.
create policy "invited users can join via invite"
  on members for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from workspace_invites
      where workspace_invites.workspace_id = members.workspace_id
        and lower(workspace_invites.email) = lower(auth.jwt() ->> 'email')
        and workspace_invites.accepted_at is null
        and workspace_invites.expires_at > now()
    )
  );

-- Allow members to remove themselves from a workspace (leave).
create policy "members can remove themselves"
  on members for delete
  using (user_id = auth.uid());