-- Prepaid QR-bag pickups: pay the collector from the scanned bags.
--
-- A pickup request is prepaid: the household bought the bags, and the price of
-- each bag (bags.unit_price, copied from its batch) includes the pickup. The
-- household is never charged at pickup. The collector earns 100 percent of the
-- unit price of every bag they scan for the request, plus tips. No platform
-- request fee is taken off.
--
-- Until now the collector app gave each scanned bag a random fee on the phone,
-- never linked the bag to the request, and worked the payout out at disposal
-- from pickup_requests.fee (one unit price) minus a 1 cedi request fee. The
-- payout is now calculated here, in the database, from the bags themselves, so
-- the phone only shows it.
--
-- 1. scan_pickup_request_bag: the collector scans a bag QR
--    (https://trashdrops.com/scan?batch=<batch id>&bag=<bag number>). The bag
--    must belong to the household of the request and not be collected for
--    another request. It is marked scanned and linked to the request, and the
--    payout on the request is recalculated from all its scanned bags.
-- 2. finalize_pickup_request_payout: at disposal, recalculates the payout and
--    adds confirmed tips. A request with no scanned bags (scanned before this
--    change) is paid the unit price of its batch for each requested bag.
--
-- Withdrawals already pay from pickup_requests.collector_total_payout of
-- disposed requests (td_withdrawable_items), so they follow automatically.
-- Payouts already stored on older requests are not changed.
--
-- Safe to re-run.

BEGIN;

ALTER TABLE public.bags
  ADD COLUMN IF NOT EXISTS scanned boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS scanned_at timestamptz,
  ADD COLUMN IF NOT EXISTS collector_id uuid,
  ADD COLUMN IF NOT EXISTS pickup_request_id text;

CREATE INDEX IF NOT EXISTS idx_bags_pickup_request_id ON public.bags (pickup_request_id)
  WHERE pickup_request_id IS NOT NULL;

-- Payout of a request from its scanned bags; writes it on the request.
-- Internal: called by the two functions below.
CREATE OR REPLACE FUNCTION public.td_apply_prepaid_bag_payout(p_request_id text, p_tips numeric DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_bags jsonb;
  v_count integer;
  v_total numeric;
  v_tips numeric;
  v_n integer;
  v_unit numeric;
  v_model text := 'prepaid_bags';
  v_breakdown jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'bag_id', x.id, 'batch_id', x.batch_id, 'bag_no', x.bag_no, 'unit_price', x.price)
           ORDER BY x.batch_id, x.bag_no), '[]'::jsonb),
         count(*),
         coalesce(sum(x.price), 0)
  INTO v_bags, v_count, v_total
  FROM (
    SELECT bg.id, bg.batch_id, bg.pickup_request_id,
           coalesce(bg.unit_price, b.unit_price, 0) AS price,
           row_number() OVER (PARTITION BY bg.batch_id ORDER BY bg.created_at, bg.id) AS bag_no
    FROM bags bg
    LEFT JOIN batches b ON b.id = bg.batch_id
    WHERE bg.batch_id IN (SELECT batch_id FROM bags WHERE pickup_request_id = p_request_id)
  ) x
  WHERE x.pickup_request_id = p_request_id;

  IF v_count = 0 THEN
    -- nothing scanned: the unit price of the batch of the request, per requested bag
    SELECT greatest(coalesce(pr.estimated_volume, pr.bag_count, 1), 1)::integer,
           coalesce(b.unit_price, pr.fee, 0)
    INTO v_n, v_unit
    FROM pickup_requests pr
    LEFT JOIN batches b ON b.id = pr.batch_id
    WHERE pr.id::text = p_request_id;
    v_total := coalesce(v_n, 1) * coalesce(v_unit, 0);
    v_model := 'prepaid_bags_unscanned';
  END IF;

  SELECT coalesce(p_tips, pr.collector_tips, 0) INTO v_tips
  FROM pickup_requests pr WHERE pr.id::text = p_request_id;

  v_breakdown := jsonb_build_object(
    'model', v_model,
    'bags', v_bags,
    'bags_scanned', v_count,
    'bag_total', round(v_total, 2),
    'tips', round(coalesce(v_tips, 0), 2),
    'total', round(v_total + coalesce(v_tips, 0), 2));

  UPDATE pickup_requests SET
    collector_core_payout = round(v_total, 2),
    collector_urgent_payout = 0,
    collector_distance_payout = 0,
    collector_surge_payout = 0,
    collector_recyclables_payout = 0,
    collector_loyalty_cashback = 0,
    collector_tips = round(coalesce(v_tips, 0), 2),
    collector_total_payout = round(v_total + coalesce(v_tips, 0), 2),
    platform_share = 0,
    payout_breakdown = v_breakdown,
    updated_at = now()
  WHERE id::text = p_request_id;

  RETURN v_breakdown;
END;
$fn$;

REVOKE ALL ON FUNCTION public.td_apply_prepaid_bag_payout(text, numeric) FROM PUBLIC, anon, authenticated;

-- The collector scans one bag for a request they hold.
-- Pass the batch id and bag number from the bag QR, or the bag id itself.
CREATE OR REPLACE FUNCTION public.scan_pickup_request_bag(
  p_request_id text,
  p_batch_id uuid DEFAULT NULL,
  p_bag_no integer DEFAULT NULL,
  p_bag_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_me uuid := auth.uid();
  v_req record;
  v_bag record;
  v_already boolean := false;
  v_payout jsonb;
BEGIN
  IF v_me IS NULL OR NOT public.is_active_collector(v_me) THEN
    RAISE EXCEPTION 'Only registered, active collectors can scan bags' USING ERRCODE = '42501';
  END IF;

  SELECT pr.id::text AS id, pr.user_id, pr.collector_id, pr.status
  INTO v_req
  FROM pickup_requests pr WHERE pr.id::text = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pickup request not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_req.collector_id IS DISTINCT FROM v_me THEN
    RAISE EXCEPTION 'This pickup request is not assigned to you' USING ERRCODE = '42501';
  END IF;
  IF v_req.status NOT IN ('accepted', 'en_route', 'arrived', 'collecting') THEN
    RAISE EXCEPTION 'Bags can only be scanned before the pickup is disposed (status is %)', v_req.status
      USING ERRCODE = '22023';
  END IF;

  SELECT x.id, x.batch_id, x.bag_no, x.user_id, x.pickup_request_id, x.price
  INTO v_bag
  FROM (
    SELECT bg.id, bg.batch_id, bg.user_id, bg.pickup_request_id,
           coalesce(bg.unit_price, b.unit_price, 0) AS price,
           row_number() OVER (PARTITION BY bg.batch_id ORDER BY bg.created_at, bg.id) AS bag_no
    FROM bags bg
    LEFT JOIN batches b ON b.id = bg.batch_id
    WHERE (p_bag_id IS NOT NULL AND bg.batch_id = (SELECT batch_id FROM bags WHERE id = p_bag_id))
       OR (p_bag_id IS NULL AND bg.batch_id = p_batch_id)
  ) x
  WHERE (p_bag_id IS NOT NULL AND x.id = p_bag_id)
     OR (p_bag_id IS NULL AND x.bag_no = p_bag_no);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This bag is not in TrashDrop. Check the QR code and try again.' USING ERRCODE = 'P0002';
  END IF;
  IF v_bag.user_id IS DISTINCT FROM v_req.user_id THEN
    RAISE EXCEPTION 'This bag belongs to another household' USING ERRCODE = '42501';
  END IF;
  IF v_bag.pickup_request_id IS NOT NULL AND v_bag.pickup_request_id <> p_request_id THEN
    RAISE EXCEPTION 'This bag was already collected on another pickup' USING ERRCODE = '23505';
  END IF;
  v_already := coalesce(v_bag.pickup_request_id = p_request_id, false);

  IF NOT v_already THEN
    UPDATE bags SET
      scanned = true,
      scanned_at = now(),
      collector_id = v_me,
      pickup_request_id = p_request_id
    WHERE id = v_bag.id;
  END IF;

  v_payout := public.td_apply_prepaid_bag_payout(p_request_id);

  RETURN jsonb_build_object(
    'bag_id', v_bag.id,
    'batch_id', v_bag.batch_id,
    'bag_no', v_bag.bag_no,
    'unit_price', round(v_bag.price, 2),
    'already_scanned', v_already,
    'payout', v_payout);
END;
$fn$;

REVOKE ALL ON FUNCTION public.scan_pickup_request_bag(text, uuid, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.scan_pickup_request_bag(text, uuid, integer, uuid) TO authenticated, service_role;

-- At disposal: the final payout of a request, with confirmed tips.
CREATE OR REPLACE FUNCTION public.finalize_pickup_request_payout(p_request_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_me uuid := auth.uid();
  v_collector uuid;
  v_tips numeric := 0;
BEGIN
  IF v_me IS NULL OR NOT public.is_active_collector(v_me) THEN
    RAISE EXCEPTION 'Only registered, active collectors can do this' USING ERRCODE = '42501';
  END IF;

  SELECT pr.collector_id INTO v_collector FROM pickup_requests pr WHERE pr.id::text = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pickup request not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_collector IS DISTINCT FROM v_me THEN
    RAISE EXCEPTION 'This pickup request is not assigned to you' USING ERRCODE = '42501';
  END IF;

  BEGIN
    SELECT coalesce(sum(t.amount), 0) INTO v_tips
    FROM collector_tips t
    WHERE t.collector_id = v_me AND t.request_id::text = p_request_id AND t.status = 'confirmed';
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    v_tips := 0;
  END;

  RETURN public.td_apply_prepaid_bag_payout(p_request_id, v_tips);
END;
$fn$;

REVOKE ALL ON FUNCTION public.finalize_pickup_request_payout(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_pickup_request_payout(text) TO authenticated, service_role;

COMMIT;
