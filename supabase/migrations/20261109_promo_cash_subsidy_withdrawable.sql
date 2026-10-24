-- Promotional bins paid in cash: TrashDrop's top-up can be cashed out.
--
-- A promotional bin pays the collector the promotional payout (for example
-- GHS 40 for one 240 L bag) while the client pays only the promotional fee
-- (GHS 22). TrashDrop covers the difference, stored at collection as
-- bin_payments.platform_subsidy (GHS 18).
--
-- Paid by MoMo/e-cash, TrashDrop holds the client's money and already pays the
-- whole payout (part A, collector_share). Paid in cash, the collector keeps
-- the client's GHS 22, but the GHS 18 top-up was never counted anywhere, so
-- it could not be cashed out. The owner approved paying it (2026-10-24).
--
-- td_withdrawable_items gains part D: one 'promo_subsidy' item per disposed
-- promotional bin paid in cash, for its platform_subsidy. Parts A, B and C are
-- unchanged from 20261104_server_side_withdrawals.sql. request_withdrawal,
-- get_collector_available_earnings and the payout functions read this list,
-- so the balance and cash-outs follow.
--
-- Safe to re-run. One transaction.
-- Undo: supabase/diagnostics/promo_cash_subsidy_withdrawable_rollback.sql

BEGIN;
SET LOCAL search_path = public;

-- withdrawal_items accepts the new item type
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
  CHECK (item_type IN ('digital_bin', 'pickup_request', 'dumping_cleanup', 'promo_subsidy'));

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

  UNION ALL
  -- D: TrashDrop's top-up on promotional bins paid in cash (the collector
  --    already has the client's cash; TrashDrop owes the rest of the payout)
  SELECT 'promo_subsidy'::text, db.id::text, max(bp.platform_subsidy), max(coalesce(db.updated_at, bp.created_at))
  FROM public.bin_payments bp
  JOIN public.digital_bins db ON db.id = bp.digital_bin_id
  WHERE db.collector_id = p_collector_id
    AND db.status = 'disposed'
    AND db.is_promotional
    AND bp.type = 'collection'
    AND bp.status = 'success'
    AND bp.payment_mode = 'cash'
    AND bp.platform_subsidy > 0
    AND db.id::text NOT IN (SELECT i.item_id FROM in_withdrawals i WHERE i.item_type = 'promo_subsidy')
  GROUP BY db.id
$$;

REVOKE ALL ON FUNCTION public.td_withdrawable_items(uuid) FROM public, anon, authenticated;

COMMENT ON FUNCTION public.td_withdrawable_items(uuid) IS
  'Unpaid collector earnings, one row per item. Part D pays TrashDrop''s top-up on promotional bins paid in cash (Accepted TrashDrop Digital Bin Pricing; see docs/DIGITAL_BIN_PRICING.md in TrashDrop-Mobile-User-Domestic).';

COMMIT;
