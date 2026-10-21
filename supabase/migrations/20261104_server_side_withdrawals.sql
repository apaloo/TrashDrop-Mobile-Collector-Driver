-- Cash-out amounts are decided and checked by the database, not the app.
--
-- Before: the app picked the earnings items, inserted the withdrawal and its
-- withdrawal_items itself, then asked the trendipay-proxy to pay any amount.
--   * withdrawal_items has RLS on with no policies, so the app's insert was
--     always refused and every cash-out failed ("Failed to link items").
--   * nothing on the server compared the paid amount with real earnings, and
--     the proxy would pay the same withdrawal again if the call was replayed.
--   * the app could take "part" of an item, but an item counts as withdrawn
--     in full once linked, so the rest of it was lost.
--
-- Now:
--   td_withdrawable_items(collector)  one itemised list of unpaid earnings;
--                                      get_collector_available_earnings() is
--                                      its total, so balance and cash-out agree
--   request_withdrawal(amount, ...)   collector-callable: picks WHOLE items up
--                                      to the amount (all of them if the amount
--                                      covers the balance, otherwise largest
--                                      first), creates the
--                                      withdrawal + items in one transaction
--   td_begin_payout(...)              service role only (trendipay-proxy):
--                                      checks owner, amount and items, then
--                                      marks the withdrawal processing, so it
--                                      can only be paid once
--   td_finish_payout(...)             service role only: records the gateway
--                                      result (failed frees the items again)
--
-- Safe to re-run.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Unpaid earnings, one row per item. Same rules as the three parts of the
--    old get_collector_available_earnings().
-- ---------------------------------------------------------------------------
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

-- The balance shown in the app is the total of the same items
CREATE OR REPLACE FUNCTION public.get_collector_available_earnings(p_collector_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(sum(amount), 0) FROM public.td_withdrawable_items(p_collector_id);
$$;

-- ---------------------------------------------------------------------------
-- 2. Collector asks to cash out
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_amount numeric,
  p_phone text,
  p_network text,
  p_account_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_requested numeric := round(coalesce(p_amount, 0), 2);
  v_network text := upper(btrim(coalesce(p_network, '')));
  v_available numeric;
  v_smallest numeric;
  v_total numeric := 0;
  v_count integer := 0;
  v_withdrawal_id uuid;
  r record;
BEGIN
  IF v_uid IS NULL OR NOT public.is_active_collector(v_uid) THEN
    RAISE EXCEPTION 'Only registered, active collectors can cash out' USING ERRCODE = '42501';
  END IF;
  IF v_requested <= 0 THEN
    RAISE EXCEPTION 'Enter an amount to cash out' USING ERRCODE = 'P0001';
  END IF;
  IF nullif(btrim(coalesce(p_phone, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Enter your mobile money number' USING ERRCODE = 'P0001';
  END IF;
  v_network := CASE
    WHEN v_network IN ('MTN') THEN 'MTN'
    WHEN v_network IN ('VODAFONE', 'TELECEL', 'VOD') THEN 'VODAFONE'
    WHEN v_network IN ('AIRTELTIGO', 'AIRTEL TIGO', 'AIRTEL', 'TIGO', 'AT', 'ATL') THEN 'AIRTELTIGO'
    ELSE NULL
  END;
  IF v_network IS NULL THEN
    RAISE EXCEPTION 'Choose MTN, Telecel or AirtelTigo' USING ERRCODE = 'P0001';
  END IF;

  -- One cash-out at a time per collector, so two requests can't claim the same items
  PERFORM pg_advisory_xact_lock(hashtext('withdrawal:' || v_uid::text));

  -- A cash-out that was created but never sent to the gateway frees its items
  UPDATE public.withdrawals
  SET status = 'cancelled', gateway_error = 'Not sent within 15 minutes', updated_at = now()
  WHERE collector_id = v_uid AND status = 'pending' AND created_at < now() - interval '15 minutes';

  SELECT coalesce(sum(amount), 0), min(amount) INTO v_available, v_smallest
  FROM public.td_withdrawable_items(v_uid);

  IF v_available <= 0 THEN
    RAISE EXCEPTION 'You have no earnings to cash out yet. Dispose your collected waste first.' USING ERRCODE = 'P0001';
  END IF;

  -- Whole items only, up to the requested amount: everything if the amount
  -- covers the balance, otherwise largest first (a close-to-best fit without
  -- an expensive exact search)
  CREATE TEMP TABLE IF NOT EXISTS td_withdrawal_pick (item_type text, item_id text, amount numeric) ON COMMIT DROP;
  TRUNCATE td_withdrawal_pick;
  FOR r IN
    SELECT * FROM public.td_withdrawable_items(v_uid) ORDER BY amount DESC, earned_at NULLS LAST, item_id
  LOOP
    IF v_total + r.amount <= v_requested THEN
      INSERT INTO td_withdrawal_pick VALUES (r.item_type, r.item_id, r.amount);
      v_total := v_total + r.amount;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'The smallest amount you can cash out right now is GHS %', to_char(v_smallest, 'FM999999990.00')
      USING ERRCODE = 'P0001';
  END IF;
  IF v_total < 1 THEN
    RAISE EXCEPTION 'The minimum cash-out is GHS 1.00' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.withdrawals (collector_id, amount, status, payment_method, phone_number, network, payment_details)
  VALUES (v_uid, v_total, 'pending', 'mobile_money', btrim(p_phone), v_network,
          jsonb_build_object('accountName', coalesce(nullif(btrim(p_account_name), ''), 'Collector'),
                             'itemCount', v_count, 'requestedAmount', v_requested))
  RETURNING id INTO v_withdrawal_id;

  INSERT INTO public.withdrawal_items (withdrawal_id, item_type, item_id, amount)
  SELECT v_withdrawal_id, item_type, item_id, amount FROM td_withdrawal_pick;

  RETURN jsonb_build_object(
    'withdrawal_id', v_withdrawal_id,
    'amount', v_total,
    'requested', v_requested,
    'items', v_count,
    'available', v_available
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_withdrawal(numeric, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(numeric, text, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. trendipay-proxy: claim a withdrawal for payment (once), then record the
--    result. Service role only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.td_begin_payout(p_withdrawal_id uuid, p_user_id uuid, p_amount_pesewas bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.withdrawals;
  v_items numeric;
BEGIN
  SELECT * INTO w FROM public.withdrawals WHERE id = p_withdrawal_id FOR UPDATE;
  IF NOT FOUND OR w.collector_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Cash-out not found' USING ERRCODE = 'P0002';
  END IF;
  IF w.status <> 'pending' THEN
    RAISE EXCEPTION 'This cash-out has already been sent (it is %)', w.status USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.is_active_collector(p_user_id) THEN
    RAISE EXCEPTION 'Only registered, active collectors can cash out' USING ERRCODE = '42501';
  END IF;
  IF round(w.amount * 100) <> p_amount_pesewas THEN
    RAISE EXCEPTION 'Amount does not match the cash-out (GHS %)', to_char(w.amount, 'FM999999990.00') USING ERRCODE = 'P0001';
  END IF;
  SELECT coalesce(sum(amount), 0) INTO v_items FROM public.withdrawal_items WHERE withdrawal_id = w.id;
  IF round(v_items, 2) <> round(w.amount, 2) THEN
    RAISE EXCEPTION 'Cash-out items do not add up to the amount' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.withdrawals SET status = 'processing', processed_at = now(), updated_at = now()
  WHERE id = w.id;

  RETURN jsonb_build_object('withdrawal_id', w.id, 'amount', w.amount,
                            'phone_number', w.phone_number, 'network', w.network);
END;
$$;

CREATE OR REPLACE FUNCTION public.td_finish_payout(
  p_withdrawal_id uuid,
  p_ok boolean,
  p_transaction_id text DEFAULT NULL,
  p_response jsonb DEFAULT NULL,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.withdrawals
  SET status = CASE WHEN p_ok THEN status ELSE 'failed' END,   -- stays processing until confirmed
      gateway_transaction_id = coalesce(p_transaction_id, gateway_transaction_id),
      gateway_response = coalesce(p_response, gateway_response),
      gateway_error = CASE WHEN p_ok THEN NULL ELSE p_error END,
      updated_at = now()
  WHERE id = p_withdrawal_id AND status = 'processing';
$$;

REVOKE ALL ON FUNCTION public.td_begin_payout(uuid, uuid, bigint) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.td_finish_payout(uuid, boolean, text, jsonb, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.td_begin_payout(uuid, uuid, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.td_finish_payout(uuid, boolean, text, jsonb, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Collectors can read the items of their own withdrawals; only the
--    functions above write them. Collectors can no longer edit a withdrawal's
--    amount or status themselves (the old app-side flow needed that).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS withdrawal_items_view_own ON public.withdrawal_items;
CREATE POLICY withdrawal_items_view_own ON public.withdrawal_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.withdrawals w WHERE w.id = withdrawal_id AND w.collector_id = auth.uid()));

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.withdrawal_items FROM anon, authenticated;

DROP POLICY IF EXISTS insert_own_withdrawals ON public.withdrawals;
DROP POLICY IF EXISTS update_own_withdrawals ON public.withdrawals;

COMMIT;
