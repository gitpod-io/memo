-- Update handle_new_user to extract avatar_url and broader display_name from
-- OAuth provider metadata (GitHub, Google). Both providers store avatar_url in
-- raw_user_meta_data. Display name may come from full_name (Google), user_name
-- (GitHub), or display_name (email sign-up).

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _display_name text;
  _avatar_url text;
  _email text;
  _workspace_id uuid;
  _slug text;
begin
  _email := new.email;
  _display_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'user_name', ''),
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    split_part(_email, '@', 1)
  );
  _avatar_url := nullif(new.raw_user_meta_data ->> 'avatar_url', '');

  -- Create profile
  insert into public.profiles (id, email, display_name, avatar_url)
  values (new.id, _email, _display_name, _avatar_url);

  -- Generate a unique slug from the display name
  _slug := lower(regexp_replace(_display_name, '[^a-zA-Z0-9]', '-', 'g'));
  _slug := regexp_replace(_slug, '-+', '-', 'g');
  _slug := trim(both '-' from _slug);
  -- Append a random suffix to ensure uniqueness
  _slug := _slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  -- Create personal workspace
  insert into public.workspaces (id, name, slug, is_personal, created_by)
  values (
    gen_random_uuid(),
    _display_name || '''s Workspace',
    _slug,
    true,
    new.id
  )
  returning id into _workspace_id;

  -- Create owner membership
  insert into public.members (workspace_id, user_id, role, joined_at)
  values (_workspace_id, new.id, 'owner', now());

  return new;
end;
$$;
