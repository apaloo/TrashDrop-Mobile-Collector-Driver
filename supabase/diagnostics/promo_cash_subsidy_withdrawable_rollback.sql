-- Undo supabase/migrations/20261109_promo_cash_subsidy_withdrawable.sql
--
-- Restores td_withdrawable_items without part D (as in
-- 20261104_server_side_withdrawals.sql). The item_type check keeps
-- 'promo_subsidy' while any withdrawal still lists such an item, so past
-- cash-outs stay valid; otherwise it goes back to the three earlier types.
-- One transaction.

BEGIN;
SET LOCAL search_path = public;

CREATE OR REPLACE FUNCTION public.td_withdrawable_items(p_collector_id uuid)
RETURNS TABLE (item_type text, item_id text, amount numeric, earned_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH in_withdrawals AS (
    SELECT wi.item_type, wi.item_id
    FROM public.withdrawal_items wi
    JOIN public.withdrawals w ON w.id = wi.withdrawal_id
    WHERE w.status NOT IN ('failed', 'cancelled')
  )
  -- A: digital bins (actual gateway receipts)
  SELECT 'digital_bin'::text, db.id::text, sum(bp.collector_share), max(coalesce(db.updated_at, bp.created_at))
  FROM public.bin_payments bp
  JOIN public.digital_bins db ON db.id = bp.digital_bin_id
  WHERE db.collector_id = p_collector_id
    AND db.status = 'disposed'
    AND bp.type = 'collection'
    AND bp.status <> 'failed'
    AND bp.payment_mode IN ('momo', 'e_cash')
    AND db.id::text NOT IN (SELECT i.item_id FROM in_withdrawals i WHERE i.item_type = 'digital_bin')
    AND db.id NOT IN (
      SELECT bp2.digital_bin_id FROM public.bin_payments bp2
      WHERE bp2.type = 'disbursement' AND bp2.status = 'success' AND bp2.digital_bin_id IS NOT NULL
    )
  GROUP BY db.id
  HAVING sum(bp.collector_share) > 0

  UNION ALL
  -- B: pickup requests (prepaid, fixed fee)
  SELECT 'pickup_request'::text, pr.id::text, pr.collector_total_payout, coalesce(pr.disposed_at, pr.updated_at)
  FROM public.pickup_requests pr
  WHERE pr.collector_id = p_collector_id
    AND pr.status = 'disposed'
    AND pr.collector_total_payout > 0
    AND pr.id::text NOT IN (SELECT i.item_id FROM in_withdrawals i WHERE i.item_type = 'pickup_request')

  UNION ALL
  -- C: illegal dumping cleanups (paid by TrashDrop, disposed)
  SELECT 'dumping_cleanup'::text, v.id::text, v.payment, coalesce(v.disposed_at, v.updated_at)
  FROM public.collector_assignments_view v
  WHERE v.collector_id = p_collector_id
    AND v.original_status = 'disposed'
    AND v.payment > 0
    AND v.id::text NOT IN (SELECT i.item_id FROM in_withdrawals i WHERE i.item_type = 'dumping_cleanup')
$$;

REVOKE ALL ON FUNCTION public.td_withdrawable_items(uuid) FROM public, anon, authenticated;
COMMENT ON FUNCTION public.td_withdrawable_items(uuid) IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.withdrawal_items WHERE item_type = 'promo_subsidy') THEN
    ALTER TABLE public.withdrawal_items DROP CONSTRAINT IF EXISTS withdrawal_items_item_type_check;
    ALTER TABLE public.withdrawal_items ADD CONSTRAINT withdrawal_items_item_type_check
      CHECK (item_type IN ('digital_bin', 'pickup_request', 'dumping_cleanup'));
  END IF;
END $$;

COMMIT;
