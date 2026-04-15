-- Additional RLS policies and functions for the workspace members invite/accept flow.
-- The base tables and core policies exist in 20260415092907_create_schema.sql.

-- Lookup an invite by token. Uses security definer to bypass RLS so both
-- anon (unauthenticated) and authenticated users can view the invite page.
-- Tokens are unguessable UUIDs, so exposing a single row by exact match is safe.
create or replace function get_invite_by_token(invite_token text)
returns table (
  id uuid,
  workspace_id uuid,
  email text,
  role invite_role,
  invited_by uuid,
  token text,
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz,
  workspace_name text,
  workspace_slug text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    wi.id,
    wi.workspace_id,
    wi.email,
    wi.role,
    wi.invited_by,
    wi.token,
    wi.expires_at,
    wi.accepted_at,
    wi.created_at,
    w.name as workspace_name,
    w.slug as workspace_slug
  from public.workspace_invites wi
  join public.workspaces w on w.id = wi.workspace_id
  where wi.token = invite_token;
$$;

-- Accept an invite: marks the invite as accepted and inserts the member row.
-- Uses security definer to enforce that only accepted_at is set on the invite
-- and the member role matches the invite role (preventing escalation).
create or replace function accept_invite(invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite record;
begin
  -- Lock and validate the invite
  select * into v_invite
  from public.workspace_invites
  where id = invite_id
    and lower(email) = lower(auth.jwt() ->> 'email')
    and accepted_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Invalid, expired, or already accepted invite';
  end if;

  -- Mark invite as accepted
  update public.workspace_invites
  set accepted_at = now()
  where id = invite_id;

  -- Insert member with the role from the invite (prevents role escalation)
  insert into public.members (workspace_id, user_id, role, joined_at)
  values (v_invite.workspace_id, auth.uid(), v_invite.role::text::public.member_role, now())
  on conflict (workspace_id, user_id) do nothing;
end;
$$;

-- Allow members to remove themselves from a workspace (leave).
create policy "members can remove themselves"
  on members for delete
  using (user_id = auth.uid());
