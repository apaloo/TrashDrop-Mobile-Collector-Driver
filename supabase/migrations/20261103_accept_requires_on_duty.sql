-- Only On-Duty collectors can accept pickup requests and digital bins.
--
-- The app hides available requests while a collector is Off-Duty, but the
-- database accepted a request from anyone with an active collector profile,
-- so an old screen or a direct API call could still take one while Off-Duty.
--
-- 1. collector_profiles.on_duty: set by the app's On-/Off-Duty button
--    (statusService), and set false on sign-in and sign-out. Not the same as
--    is_online, which only means "the Map recently sent a location".
-- 2. enforce_active_collector_claim() (20261013_require_collector_profile.sql)
--    also requires on_duty when a collector takes a pickup request or a
--    digital bin for themselves. Unchanged otherwise:
--      * service role / backend (auth.uid() IS NULL) is trusted
--      * staff assigning a job to someone else are not checked for duty
--      * authority_assignments (illegal dumping cleanups) are not affected
--      * updates that don't change collector_id (en route, picked up,
--        releasing a job) are not affected
--
-- Safe to re-run.

BEGIN;

ALTER TABLE public.collector_profiles
  ADD COLUMN IF NOT EXISTS on_duty boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS on_duty_changed_at timestamptz;

COMMENT ON COLUMN public.collector_profiles.on_duty IS
  'Collector''s On-Duty switch in the app. Required to accept pickup requests and digital bins.';

CREATE OR REPLACE FUNCTION public.enforce_active_collector_claim()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW; -- service role / backend
  END IF;

  IF NEW.collector_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.collector_id IS DISTINCT FROM OLD.collector_id) THEN

    IF NOT public.is_active_collector(NEW.collector_id) THEN
      RAISE EXCEPTION 'Only registered, active collectors can take jobs'
        USING ERRCODE = '42501';
    END IF;

    -- A collector taking a request or bin for themselves must be On-Duty
    IF TG_TABLE_NAME IN ('pickup_requests', 'digital_bins')
       AND NEW.collector_id = auth.uid()
       AND NOT EXISTS (
         SELECT 1 FROM public.collector_profiles cp
         WHERE cp.user_id = auth.uid() AND cp.on_duty
       ) THEN
      RAISE EXCEPTION 'Go On-Duty to accept requests'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
