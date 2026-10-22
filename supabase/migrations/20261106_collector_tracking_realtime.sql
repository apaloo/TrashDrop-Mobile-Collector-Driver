-- Live collector tracking in the user app.
--
-- The user app follows a pickup through Supabase Realtime: it listens for
-- UPDATEs on the collector's collector_profiles row (location), on the
-- pickup_requests / digital_bins row (status) and for INSERTs into
-- notifications (en route, ETA, arrived). Realtime only sends changes for
-- tables in the supabase_realtime publication, so make sure all four are in it.
--
-- Also: update_collector_location() skips its caller check when auth.uid() is
-- NULL so the backend can call it, but the anon key (shipped in both apps) has
-- no auth.uid() either, so anyone could move any collector's pin. Only
-- signed-in users and the backend may call it.
--
-- Safe to re-run.

BEGIN;

DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['collector_profiles', 'pickup_requests', 'digital_bins', 'notifications'] LOOP
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      EXCEPTION WHEN duplicate_object OR undefined_table THEN NULL;
      END;
    END LOOP;
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.update_collector_location(uuid, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_collector_location(uuid, double precision, double precision) TO authenticated, service_role;

COMMIT;
