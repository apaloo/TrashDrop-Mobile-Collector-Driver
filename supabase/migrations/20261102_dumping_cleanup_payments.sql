-- ============================================================================
-- Illegal dumping cleanups: one payment rule, counted in earnings and payouts.
--
-- Until now the admin's cleanup fee (illegal_dumping_mobile.cleanup_fee, set
-- when assigning a report) was saved but never used. The app showed its own
-- amount from report size and severity, and neither amount reached earnings
-- or withdrawals.
--
-- 1. td_cleanup_payment(): the admin's fee when one was set (> 0), otherwise
--    the size × severity amount the app already showed. Volunteer groups are
--    unpaid: always 0.
-- 2. collector_assignments_view.payment uses it (same columns, same order;
--    CREATE OR REPLACE refuses to run if the live view has a different
--    shape, so nothing is changed by mistake).
-- 3. withdrawal_items may hold 'dumping_cleanup' items.
-- 4. get_collector_available_earnings() adds disposed cleanups that are not
--    in a withdrawal yet (validate_cashout() uses it, so it follows).
--
-- Like pickups, a cleanup becomes withdrawable once its waste is disposed.
-- Additive and safe to re-run. One transaction.
-- Undo with supabase/diagnostics/dumping_cleanup_payments_rollback.sql.
-- ============================================================================

BEGIN;
SET LOCAL search_path = public;

-- ── 1. the payment rule ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.td_cleanup_payment(
  p_cleanup_fee numeric, p_size text, p_severity text, p_collector_type text)
RETURNS numeric
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN coalesce(p_collector_type, 'collector') = 'volunteer' THEN 0::numeric
    WHEN p_cleanup_fee > 0 THEN round(p_cleanup_fee, 2)
    ELSE round(
      CASE p_size WHEN 'small' THEN 5.00 WHEN 'medium' THEN 10.00 WHEN 'large' THEN 20.00 ELSE 10.00 END
      * CASE p_severity WHEN 'high' THEN 1.5 ELSE 1.0 END, 2)
  END
$$;

-- ── 2. the collector app's view ───────────────────────────────────────────
-- Same columns as 20260428_add_disposed_status_to_illegal_dumping_mobile.sql;
-- only `payment` changes.
CREATE OR REPLACE VIEW public.collector_assignments_view AS
SELECT
  idm.id,
  cp.user_id AS collector_id,
  idm.assigned_to AS collector_profile_id,
  idm.waste_type AS type,
  idm.location,
  idm.latitude,
  idm.longitude,
  idm.severity AS priority,
  idm.size,
  idm.photos,
  idm.reported_by,

  CASE idm.status
    WHEN 'verified' THEN 'available'
    WHEN 'in_progress' THEN 'accepted'
    WHEN 'completed' THEN 'completed'
    WHEN 'disposed' THEN 'disposed'
    ELSE idm.status
  END AS status,

  idm.status AS original_status,
  idm.created_at,
  idm.updated_at,

  idm.disposed_at,
  idm.disposal_site_id,
  idm.disposal_site_name,

  'Community Report' AS authority,

  public.td_cleanup_payment(idm.cleanup_fee, idm.size, idm.severity, to_jsonb(cp) ->> 'collector_type') AS payment,

  CASE idm.size
    WHEN 'small' THEN '15 mins'
    WHEN 'medium' THEN '30 mins'
    WHEN 'large' THEN '1 hour'
    ELSE '30 mins'
  END AS estimated_time,

  'Calculate' AS distance

FROM illegal_dumping_mobile idm
INNER JOIN collector_profiles cp ON idm.assigned_to = cp.id
WHERE idm.assigned_to IS NOT NULL
  AND idm.status IN ('verified', 'in_progress', 'completed', 'disposed');

-- ── 3. withdrawal items may be cleanups ───────────────────────────────────
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.withdrawal_items'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%item_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.withdrawal_items DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
ALTER TABLE public.withdrawal_items ADD CONSTRAINT withdrawal_items_item_type_check
  CHECK (item_type IN ('digital_bin', 'pickup_request', 'dumping_cleanup'));

-- ── 4. available balance includes disposed cleanups ───────────────────────
-- Parts A and B unchanged from 20260517_withdrawal_items_and_fix_rpcs.sql
CREATE OR REPLACE FUNCTION public.get_collector_available_earnings(p_collector_id uuid)
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    -- Part A: Digital bin earnings (actual gateway receipts)
    COALESCE((
      SELECT SUM(bp.collector_share)
      FROM bin_payments bp
      INNER JOIN digital_bins db ON db.id = bp.digital_bin_id
      WHERE db.collector_id = p_collector_id
        AND db.status = 'disposed'
        AND bp.type = 'collection'
        AND bp.status != 'failed'
        AND bp.payment_mode IN ('momo', 'e_cash')
        AND db.id::text NOT IN (
          SELECT wi.item_id
          FROM withdrawal_items wi
          INNER JOIN withdrawals w ON w.id = wi.withdrawal_id
          WHERE wi.item_type = 'digital_bin'
            AND w.status NOT IN ('failed', 'cancelled')
        )
        AND db.id NOT IN (
          SELECT bp2.digital_bin_id
          FROM bin_payments bp2
          WHERE bp2.type = 'disbursement'
            AND bp2.status = 'success'
            AND bp2.digital_bin_id IS NOT NULL
        )
    ), 0)
    +
    -- Part B: Pickup request earnings (prepaid, fixed fee)
    COALESCE((
      SELECT SUM(pr.collector_total_payout)
      FROM pickup_requests pr
      WHERE pr.collector_id = p_collector_id
        AND pr.status = 'disposed'
        AND pr.collector_total_payout IS NOT NULL
        AND pr.collector_total_payout > 0
        AND pr.id NOT IN (
          SELECT wi.item_id
          FROM withdrawal_items wi
          INNER JOIN withdrawals w ON w.id = wi.withdrawal_id
          WHERE wi.item_type = 'pickup_request'
            AND w.status NOT IN ('failed', 'cancelled')
        )
    ), 0)
    +
    -- Part C: Illegal dumping cleanups (paid by TrashDrop, disposed, not yet withdrawn)
    COALESCE((
      SELECT SUM(v.payment)
      FROM collector_assignments_view v
      WHERE v.collector_id = p_collector_id
        AND v.original_status = 'disposed'
        AND v.payment > 0
        AND v.id::text NOT IN (
          SELECT wi.item_id
          FROM withdrawal_items wi
          INNER JOIN withdrawals w ON w.id = wi.withdrawal_id
          WHERE wi.item_type = 'dumping_cleanup'
            AND w.status NOT IN ('failed', 'cancelled')
        )
    ), 0);
$$;

GRANT EXECUTE ON FUNCTION public.get_collector_available_earnings(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
