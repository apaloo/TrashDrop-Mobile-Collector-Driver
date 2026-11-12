-- TD53: collectors cash out a digital bin only once the client's MoMo/e-Cash
-- payment is confirmed by the payment gateway or by an admin (owner's
-- decision 2026-11-12, "Confirmed only"; protected payout rule,
-- docs/COLLECTOR_PAYOUTS.md in the household repository).
--
-- (a) bin_payments.confirmed_by records who confirmed a payment: 'gateway'
--     (the signed webhook or the server's own status check, both with the
--     service key), 'staff' (an admin) or 'collector' (the collector's
--     "Client has paid" tap). The database sets it; nobody can write it.
-- (b) td_withdrawable_items part A counts only payments confirmed by the
--     gateway or an admin.
-- (c) A collector can still confirm their own payment (owner's decision
--     2026-11-12); it shows as confirmed in the app but is not cashable
--     until the gateway or an admin confirms it.
-- (d) A collector can no longer change a failed payment.
-- (f) Existing confirmed payments (test payments, May 2026) have no record of
--     who confirmed them, so they are not cashable until an admin confirms.

alter table public.bin_payments
  add column if not exists confirmed_by text
  check (confirmed_by in ('gateway', 'staff', 'collector'));

comment on column public.bin_payments.confirmed_by is
  'Who confirmed the payment (set by td_guard_bin_payment): gateway, staff or collector. Only gateway or staff confirmations can be cashed out (TD53).';

create or replace function public.td_guard_bin_payment()
returns trigger language plpgsql security definer
set search_path to 'public' as $function$
declare
  me uuid := auth.uid();
  is_staff boolean := (me is not null and public.td_can_manage_requests());
  b record;
  cap_subsidy numeric;
  paid numeric;
begin
  -- Who confirmed it: always worked out here, never taken from the caller
  if new.status = 'success' then
    if me is null then
      new.confirmed_by := 'gateway';            -- service key: webhook or server status check
    elsif is_staff then
      new.confirmed_by := case when tg_op = 'UPDATE' and old.confirmed_by = 'gateway' then 'gateway' else 'staff' end;
    elsif tg_op = 'UPDATE' and old.status = 'success' then
      new.confirmed_by := old.confirmed_by;     -- a collector can't upgrade a confirmation
    else
      new.confirmed_by := 'collector';
    end if;
  else
    new.confirmed_by := null;
  end if;

  if me is null or is_staff then
    return new; -- service key (gateway webhook, payout functions) or staff
  end if;

  if tg_op = 'INSERT' then
    select id, collector_id, collector_total_payout, is_promotional, bin_size_liters, fee, is_urgent, deadhead_km
      into b from public.digital_bins where id = new.digital_bin_id;
    if not found or b.collector_id is distinct from me then
      raise exception 'You can only record payments for your own pickups' using errcode = '42501';
    end if;
    if coalesce(new.type, 'collection') <> 'collection' then
      raise exception 'Only collections can be recorded here' using errcode = '42501';
    end if;
    new.type := 'collection';
    new.status := 'pending';
    new.confirmed_by := null;
    new.is_promotional := coalesce(b.is_promotional, false);
    paid := least(coalesce(new.total_bill, 0), coalesce(b.fee, 0));
    if new.is_promotional then
      -- the booked promotional payout; TrashDrop covers the rest (capped by the schedule)
      new.collector_share := greatest(0, least(coalesce(new.collector_share, 0), coalesce(b.collector_total_payout, 0)));
      select platform_subsidy into cap_subsidy from public.promotional_fee_schedule
        where bin_size_liters = b.bin_size_liters and is_active;
      new.platform_subsidy := greatest(0, least(coalesce(new.platform_subsidy, 0), coalesce(cap_subsidy, 0)));
    else
      new.collector_share := least(public.td_bin_collector_share(paid, b.fee, coalesce(b.is_urgent, false), b.deadhead_km),
                                   coalesce(b.collector_total_payout, 0));
      new.platform_share := round(paid - new.collector_share, 2);
      new.platform_subsidy := 0;
    end if;
    return new;
  end if;

  -- UPDATE: status and gateway details only; amounts and links are fixed
  if new.digital_bin_id is distinct from old.digital_bin_id or new.collector_id is distinct from old.collector_id
     or new.type is distinct from old.type or new.payment_mode is distinct from old.payment_mode
     or new.total_bill is distinct from old.total_bill or new.collector_share is distinct from old.collector_share
     or new.platform_share is distinct from old.platform_share or new.platform_subsidy is distinct from old.platform_subsidy
     or new.is_promotional is distinct from old.is_promotional then
    raise exception 'Payment amounts can''t be changed' using errcode = '42501';
  end if;
  if old.status = 'success' and new.status is distinct from old.status then
    raise exception 'A confirmed payment can''t be changed' using errcode = '42501';
  end if;
  if old.status = 'failed' and new.status is distinct from old.status then
    raise exception 'A failed payment can''t be changed' using errcode = '42501';
  end if;
  return new;
end $function$;

create or replace function public.td_withdrawable_items(p_collector_id uuid)
returns table(item_type text, item_id text, amount numeric, earned_at timestamp with time zone)
language sql stable security definer
set search_path to 'public' as $function$
  WITH in_withdrawals AS (
    SELECT wi.item_type, wi.item_id
    FROM public.withdrawal_items wi
    JOIN public.withdrawals w ON w.id = wi.withdrawal_id
    WHERE w.status NOT IN ('failed', 'cancelled')
  )
  -- A: digital bins: client payments confirmed by the gateway or an admin
  --    (TD53), at most the bin's stored payout
  SELECT 'digital_bin'::text, db.id::text,
         least(sum(bp.collector_share), coalesce(max(db.collector_total_payout), 0)),
         max(coalesce(db.updated_at, bp.created_at))
  FROM public.bin_payments bp
  JOIN public.digital_bins db ON db.id = bp.digital_bin_id
  WHERE db.collector_id = p_collector_id
    AND db.status = 'disposed'
    AND bp.type = 'collection'
    AND bp.status = 'success'
    AND bp.confirmed_by IN ('gateway', 'staff')
    AND bp.payment_mode IN ('momo', 'e_cash')
    AND db.id::text NOT IN (SELECT i.item_id FROM in_withdrawals i WHERE i.item_type = 'digital_bin')
    AND db.id NOT IN (
      SELECT bp2.digital_bin_id FROM public.bin_payments bp2
      WHERE bp2.type = 'disbursement' AND bp2.status = 'success' AND bp2.digital_bin_id IS NOT NULL
    )
  GROUP BY db.id
  HAVING least(sum(bp.collector_share), coalesce(max(db.collector_total_payout), 0)) > 0

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
$function$;
