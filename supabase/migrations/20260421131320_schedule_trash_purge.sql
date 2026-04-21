-- Schedule daily purge of pages trashed for more than 30 days.
--
-- Attempts to use pg_cron (available on Supabase Pro+). If pg_cron is not
-- available, the migration succeeds silently — the Vercel Cron job at
-- GET /api/cron/purge-trash serves as the guaranteed fallback.

do $outer$
begin
  create extension if not exists pg_cron;

  perform cron.schedule(
    'purge-old-trash',
    '0 3 * * *',
    $$select public.purge_old_trash()$$
  );
exception
  when others then
    raise notice 'pg_cron not available (%), trash purge will run via Vercel Cron', sqlerrm;
end;
$outer$;
