-- Security hardening: block anonymous storage enumeration and restrict
-- RPC execute permissions to authenticated users only.
--
-- Fixes reported by security researcher (Lorenzo):
--   1. Anonymous users can enumerate and download all objects in page-images
--      and feedback-screenshots buckets via POST /storage/v1/object/list/.
--   2. Feedback screenshots are publicly listable and downloadable.
--   3. User account enumeration via /auth/v1/signup (dashboard fix — see below).
--
-- Additional findings from full RLS audit:
--   4. Four security-definer RPCs callable by anon with no internal auth check:
--      usage_event_counts_7d, purge_old_page_versions, prune_excess_page_versions,
--      purge_old_trash.
--
-- MANUAL STEP REQUIRED AFTER DEPLOY:
--   In the Supabase Dashboard, go to Authentication → Settings → Security
--   and enable "Protect against email enumeration attacks". This prevents
--   the /auth/v1/signup endpoint from revealing whether an email is registered.

-- =============================================================================
-- 1. Storage: replace public SELECT policies with authenticated-only
-- =============================================================================
-- Buckets remain public: true so direct-URL image rendering (/object/public/...)
-- continues to work. Only the listing API (/object/list/...) is restricted.

-- ---- page-images ----
DROP POLICY IF EXISTS "Public read access for page images" ON storage.objects;

DO $$ BEGIN
  CREATE POLICY "Authenticated read access for page images"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'page-images');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---- feedback-screenshots ----
DROP POLICY IF EXISTS "Public read access for feedback screenshots" ON storage.objects;

DO $$ BEGIN
  CREATE POLICY "Authenticated read access for feedback screenshots"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'feedback-screenshots');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- 2. RPCs: revoke execute from public/anon, grant to authenticated only
-- =============================================================================
-- Service role key bypasses these restrictions, so cron jobs and automations
-- that use createAdminClient() are unaffected.

-- ---- Critical: no internal auth check, callable by anon today ----

REVOKE EXECUTE ON FUNCTION usage_event_counts_7d(text[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION usage_event_counts_7d(text[]) TO authenticated;

REVOKE EXECUTE ON FUNCTION purge_old_page_versions() FROM public, anon;
GRANT EXECUTE ON FUNCTION purge_old_page_versions() TO authenticated;

REVOKE EXECUTE ON FUNCTION prune_excess_page_versions(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION prune_excess_page_versions(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION purge_old_trash() FROM public, anon;
GRANT EXECUTE ON FUNCTION purge_old_trash() TO authenticated;

-- ---- Defense-in-depth: have internal auth checks but should still be restricted ----

REVOKE EXECUTE ON FUNCTION search_pages(text, uuid, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION search_pages(text, uuid, integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION create_workspace(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION create_workspace(text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION delete_account() FROM public, anon;
GRANT EXECUTE ON FUNCTION delete_account() TO authenticated;

REVOKE EXECUTE ON FUNCTION accept_invite(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION accept_invite(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION soft_delete_page(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION soft_delete_page(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION restore_page(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION restore_page(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION empty_trash(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION empty_trash(uuid) TO authenticated;
