-- Applied on production 2026-11-12 at 10:05 UTC (recorded version 20261112100533),
-- with the owner's written approval: "A: written approval to change the
-- protected collector payout rules? Approved with caution".
--
-- Collector cash-outs (td_withdrawable_items) count bin_payments rows the
-- collector app writes. The database now caps what a row can be worth and
-- fixes its amounts once written; the app is unchanged.
--   insert (collector): only for the collector's own bin; status pending;
--     collector_share at most the bin's stored payout (digital_bins.collector_total_payout,
--     priced by the database at booking); platform_subsidy at most the active
--     promotional schedule for the bin size, 0 when not promotional
--   update (collector): status and gateway details only; a confirmed (success)
--     payment keeps its status
--   cash-out part A: a bin is worth at most its stored payout, however many
--     rows it has; parts B, C and D unchanged
-- Kept as before (owner decision): cash marked success by the collector, and
-- the "Client has paid - confirm" button for a MoMo payment. Server functions
-- (gateway webhook, collection, disbursement) use the service key and staff
-- are exempt.
--
-- Checked first (rolled back on production): cash-out totals unchanged for
-- every collector; an inflated share stored as the bin's payout; a payment on
-- another collector's bin refused; amount changes refused; cash flow works;
-- three rows on one bin cash out as one payout.

create or replace function public.td_guard_bin_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  b record;
  cap_subsidy numeric;
begin
  if me is null or public.td_can_manage_requests() then
    return new;  -- service key (gateway webhook, payout functions) or staff
  end if;

  if tg_op = 'INSERT' then
    select id, collector_id, collector_total_payout, is_promotional, bin_size_liters
      into b from public.digital_bins where id = new.digital_bin_id;
    if not found or b.collector_id is distinct from me then
      raise exception 'You can only record payments for your own pickups' using errcode = '42501';
    end if;
    if coalesce(new.type, 'collection') <> 'collection' then
      raise exception 'Only collections can be recorded here' using errcode = '42501';
    end if;
    new.type := 'collection';
    new.status := 'pending';
    -- Never worth more than the payout the database priced at booking
    new.collector_share := greatest(0, least(coalesce(new.collector_share, 0), coalesce(b.collector_total_payout, 0)));
    new.is_promotional := coalesce(b.is_promotional, false);
    if new.is_promotional then
      select platform_subsidy into cap_subsidy from public.promotional_fee_schedule
       where bin_size_liters = b.bin_size_liters and is_active;
      new.platform_subsidy := greatest(0, least(coalesce(new.platform_subsidy, 0), coalesce(cap_subsidy, 0)));
    else
      new.platform_subsidy := 0;
    end if;
    return new;
  end if;

  -- UPDATE: status and gateway details only; amounts and links are fixed
  if new.digital_bin_id is distinct from old.digital_bin_id
     or new.collector_id is distinct from old.collector_id
     or new.type is distinct from old.type
     or new.payment_mode is distinct from old.payment_mode
     or new.total_bill is distinct from old.total_bill
     or new.collector_share is distinct from old.collector_share
     or new.platform_share is distinct from old.platform_share
     or new.platform_subsidy is distinct from old.platform_subsidy
     or new.is_promotional is distinct from old.is_promotional then
    raise exception 'Payment amounts can''t be changed' using errcode = '42501';
  end if;
  if old.status = 'success' and new.status is distinct from old.status then
    raise exception 'A confirmed payment can''t be changed' using errcode = '42501';
  end if;
  return new;
end $$;

revoke execute on function public.td_guard_bin_payment() from public, anon, authenticated;

drop trigger if exists aa_td_guard_bin_payment on public.bin_payments;
create trigger aa_td_guard_bin_payment
  before insert or update on public.bin_payments
  for each row execute function public.td_guard_bin_payment();

-- Cash-out part A: a bin is worth at most its stored payout, however many
-- payment rows it has. Everything else in td_withdrawable_items is unchanged.
CREATE OR REPLACE FUNCTION public.td_withdrawable_items(p_collector_id uuid)
 RETURNS TABLE(item_type text, item_id text, amount numeric, earned_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH in_withdrawals AS (
    SELECT wi.item_type, wi.item_id
    FROM public.withdrawal_items wi
    JOIN public.withdrawals w ON w.id = wi.withdrawal_id
    WHERE w.status NOT IN ('failed', 'cancelled')
  )
  -- A: digital bins (actual gateway receipts), at most the bin's stored payout
  SELECT 'digital_bin'::text, db.id::text,
         least(sum(bp.collector_share), coalesce(max(db.collector_total_payout), 0)),
         max(coalesce(db.updated_at, bp.created_at))
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
