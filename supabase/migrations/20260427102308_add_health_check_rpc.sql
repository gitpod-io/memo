-- Lightweight health-check function exposed via PostgREST RPC.
-- Returns 1 with no table access, so the round-trip measures only
-- network + connection-pool latency.
create or replace function public.health_check()
returns integer
language sql
stable
security definer
as $$
  select 1;
$$;

-- Allow anonymous and authenticated callers (the health endpoint
-- uses the publishable key, which maps to the anon role).
grant execute on function public.health_check() to anon, authenticated;
