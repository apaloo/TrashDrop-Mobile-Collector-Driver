-- Require a complete, active collector profile for collector actions.
--
-- Bug: the login page created a new auth user for any phone number, and the
-- database let any signed-in user act as a collector. This migration makes
-- the database reject collector actions from users without a collector
-- profile, whatever the app does.
--
-- Rules:
--   * Requests from the service role / backend (auth.uid() IS NULL) are trusted
--     and unaffected.
--   * Customer edits to their own pickup_requests / digital_bins are unaffected;
--     only setting collector_id is checked.
--
-- Safe to re-run.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Who counts as an active collector
--    Mirrors src/utils/collectorProfile.js (getProfileState === READY).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_active_collector(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.collector_profiles cp
    WHERE cp.user_id = p_user_id
      AND cp.status <> 'suspended'
      AND cp.deactivated_at IS NULL
      AND nullif(btrim(cp.first_name), '') IS NOT NULL
      AND nullif(btrim(cp.last_name), '') IS NOT NULL
      AND nullif(btrim(cp.phone), '') IS NOT NULL
      AND nullif(btrim(cp.region), '') IS NOT NULL
      AND nullif(btrim(cp.vehicle_type), '') IS NOT NULL
      AND coalesce(nullif(btrim(cp.license_plate), ''), nullif(btrim(cp.vehicle_plate), '')) IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_collector(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_active_collector(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Login pre-check: is this phone attached to a collector profile?
--    Lets the login page say "No account found" without sending a code.
--    Matches either the auth phone or the profile phone, on digits only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.collector_phone_registered(p_phone text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  WITH target AS (
    SELECT regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') AS digits
  )
  SELECT length((SELECT digits FROM target)) >= 9 AND EXISTS (
    SELECT 1
    FROM public.collector_profiles cp
    JOIN auth.users u ON u.id = cp.user_id
    WHERE regexp_replace(coalesce(u.phone, ''), '\D', '', 'g') = (SELECT digits FROM target)
       OR regexp_replace(coalesce(cp.phone, ''), '\D', '', 'g') = (SELECT digits FROM target)
  );
$$;

REVOKE ALL ON FUNCTION public.collector_phone_registered(text) FROM public;
GRANT EXECUTE ON FUNCTION public.collector_phone_registered(text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Taking a job: setting collector_id on pickup_requests, digital_bins and
--    authority_assignments requires the assigned collector to be active.
--    Also covers the accept_pickup_request() RPC, which updates the table.
-- ---------------------------------------------------------------------------
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
     AND (TG_OP = 'INSERT' OR NEW.collector_id IS DISTINCT FROM OLD.collector_id)
     AND NOT public.is_active_collector(NEW.collector_id) THEN
    RAISE EXCEPTION 'Only registered, active collectors can take jobs'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS require_active_collector_claim ON public.pickup_requests;
CREATE TRIGGER require_active_collector_claim
  BEFORE INSERT OR UPDATE OF collector_id ON public.pickup_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_active_collector_claim();

DROP TRIGGER IF EXISTS require_active_collector_claim ON public.digital_bins;
CREATE TRIGGER require_active_collector_claim
  BEFORE INSERT OR UPDATE OF collector_id ON public.digital_bins
  FOR EACH ROW EXECUTE FUNCTION public.enforce_active_collector_claim();

DROP TRIGGER IF EXISTS require_active_collector_claim ON public.authority_assignments;
CREATE TRIGGER require_active_collector_claim
  BEFORE INSERT OR UPDATE OF collector_id ON public.authority_assignments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_active_collector_claim();

-- ---------------------------------------------------------------------------
-- 4. Cash-out: withdrawals can only be created by an active collector,
--    for themselves (the existing policy already checks collector_id).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS withdrawals_require_active_collector ON public.withdrawals;
CREATE POLICY withdrawals_require_active_collector
  ON public.withdrawals
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_collector(auth.uid()));

-- validate_cashout is SECURITY DEFINER and trusted p_collector_id from the
-- caller. Same body as before, plus a caller check.
CREATE OR REPLACE FUNCTION public.validate_cashout(p_collector_id uuid, p_amount numeric)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available numeric;
BEGIN
  IF auth.uid() IS NOT NULL
     AND (p_collector_id IS DISTINCT FROM auth.uid() OR NOT public.is_active_collector(auth.uid())) THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Only registered, active collectors can cash out',
      'available', 0
    );
  END IF;

  v_available := get_collector_available_earnings(p_collector_id);

  IF p_amount <= 0 THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Amount must be greater than zero',
      'available', v_available
    );
  END IF;

  IF p_amount > v_available THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Insufficient balance',
      'available', v_available,
      'requested', p_amount
    );
  END IF;

  RETURN json_build_object(
    'valid', true,
    'available', v_available,
    'requested', p_amount,
    'remaining', v_available - p_amount
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. On-Duty / location: update_collector_location() marks a collector online
--    (via last_active). It trusted p_user_id from the caller, so anyone could
--    mark any collector online. Same body as before, plus a caller check.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_collector_location(p_user_id uuid, p_longitude double precision, p_latitude double precision)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND (p_user_id IS DISTINCT FROM auth.uid() OR NOT public.is_active_collector(auth.uid())) THEN
    RAISE EXCEPTION 'Only registered, active collectors can go On-Duty'
      USING ERRCODE = '42501';
  END IF;

  UPDATE collector_profiles
  SET
    current_latitude = p_latitude::text,
    current_longitude = p_longitude::text,
    current_location = ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
    location_updated_at = NOW(),
    last_active = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$;

-- collector_sessions (On-Duty sessions): RLS was off, and one policy let any
-- request with an "x-dev-mode: true" header through. Turn RLS on, drop the
-- dev-mode bypass, and require an active collector for writes.
DROP POLICY IF EXISTS "Allow dev mode access to collector_sessions" ON public.collector_sessions;
ALTER TABLE public.collector_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS collector_sessions_require_active_collector_insert ON public.collector_sessions;
CREATE POLICY collector_sessions_require_active_collector_insert
  ON public.collector_sessions
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_collector(auth.uid()));

DROP POLICY IF EXISTS collector_sessions_require_active_collector_update ON public.collector_sessions;
CREATE POLICY collector_sessions_require_active_collector_update
  ON public.collector_sessions
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (public.is_active_collector(auth.uid()));

-- ---------------------------------------------------------------------------
-- 6. collector_profiles: users could insert or update ANY collector's row
--    (policies were USING (true) / WITH CHECK (true)). Limit writes to the
--    user's own row. Reads are unchanged (customers see their collector).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.collector_profiles;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.collector_profiles;
DROP POLICY IF EXISTS collector_profiles_insert_own ON public.collector_profiles;
DROP POLICY IF EXISTS collector_profiles_update_own ON public.collector_profiles;

CREATE POLICY collector_profiles_insert_own
  ON public.collector_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY collector_profiles_update_own
  ON public.collector_profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- A collector editing their own row must not lift a suspension, clear a
-- deactivation, or change their balances / rating.
CREATE OR REPLACE FUNCTION public.protect_collector_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW; -- service role / backend
  END IF;

  IF (OLD.status = 'suspended') <> (NEW.status = 'suspended')
     OR NEW.deactivated_at IS DISTINCT FROM OLD.deactivated_at
     OR NEW.deactivated_by IS DISTINCT FROM OLD.deactivated_by
     OR NEW.deactivation_reason IS DISTINCT FROM OLD.deactivation_reason
     OR NEW.pending_balance IS DISTINCT FROM OLD.pending_balance
     OR NEW.withdrawable_balance IS DISTINCT FROM OLD.withdrawable_balance
     OR NEW.rating IS DISTINCT FROM OLD.rating THEN
    RAISE EXCEPTION 'These account fields can only be changed by TrashDrop staff'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_collector_admin_fields ON public.collector_profiles;
CREATE TRIGGER protect_collector_admin_fields
  BEFORE UPDATE ON public.collector_profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_collector_admin_fields();

-- The presence trigger (sync_collector_online_status) set status to
-- 'active'/'inactive' from last_active and so silently lifted suspensions.
-- Same logic as before, but a suspended collector stays suspended and offline.
CREATE OR REPLACE FUNCTION public.sync_collector_online_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'suspended' THEN
    NEW.is_online := false;
    RETURN NEW;
  END IF;

  -- If last_active was just updated and is recent (within last 5 minutes)
  IF NEW.last_active IS NOT NULL AND
     NEW.last_active > NOW() - INTERVAL '5 minutes' THEN
    -- Set collector as online and active
    NEW.is_online := true;
    NEW.status := CASE
      WHEN NEW.status = 'busy' THEN 'busy'  -- Preserve busy status if already set
      ELSE 'active'
    END;
  ELSIF NEW.last_active IS NOT NULL AND
        NEW.last_active <= NOW() - INTERVAL '5 minutes' THEN
    -- Set collector as offline and inactive if last_active is older than 5 minutes
    NEW.is_online := false;
    NEW.status := 'inactive';
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
