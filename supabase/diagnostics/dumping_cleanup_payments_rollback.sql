-- Undo 20261102_dumping_cleanup_payments.sql.
-- The app's cleanup amount goes back to size × severity (the admin fee is
-- ignored again) and cleanups leave the available balance.
-- Stops with an error if any cleanup was already paid out through a
-- withdrawal (those withdrawal_items rows would break the old rule); in that
-- case keep the migration and tell me.
BEGIN;
SET LOCAL search_path = public;

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

  ROUND(
    CASE idm.size
      WHEN 'small' THEN 5.00
      WHEN 'medium' THEN 10.00
      WHEN 'large' THEN 20.00
      ELSE 10.00
    END *
    CASE idm.severity
      WHEN 'high' THEN 1.5
      ELSE 1.0
    END,
    2
  ) AS payment,

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
    ), 0);
$$;

GRANT EXECUTE ON FUNCTION public.get_collector_available_earnings(uuid) TO authenticated;

ALTER TABLE public.withdrawal_items DROP CONSTRAINT IF EXISTS withdrawal_items_item_type_check;
ALTER TABLE public.withdrawal_items ADD CONSTRAINT withdrawal_items_item_type_check
  CHECK (item_type IN ('digital_bin', 'pickup_request'));

DROP FUNCTION IF EXISTS public.td_cleanup_payment(numeric, text, text, text);

NOTIFY pgrst, 'reload schema';
COMMIT;
