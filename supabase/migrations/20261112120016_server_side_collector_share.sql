-- TD3 (protected payouts; owner's written approval 2026-11-12: "proceed with
-- recommendations": apply it, and keep 87% when the distance is unknown).
-- The database works out the travel distance and the collector's share
-- (docs/COLLECTOR_PAYOUTS.md in the household repository). This app needs no
-- change: it already reads deadhead_km from the bin, and the database replaces
-- its figures.

-- 1. When a collector takes a bin: record when, and how far they were (straight
--    line from their reported position, if under 15 minutes old, to the bin).
--    Unknown distance = 87%. Collectors can't set either field themselves.
create or replace function public.td_record_bin_acceptance() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare km numeric;
begin
  if new.collector_id is not null and new.collector_id is distinct from old.collector_id then
    new.accepted_at := now();
    select round((st_distancesphere(cp.current_location, l.coordinates) / 1000.0)::numeric, 2) into km
      from public.collector_profiles cp, public.bin_locations l
     where cp.user_id = new.collector_id and l.id = new.location_id
       and cp.current_location is not null and l.coordinates is not null
       and cp.location_updated_at > now() - interval '15 minutes'
     order by cp.location_updated_at desc limit 1;
    new.deadhead_km := km;
  elsif auth.uid() is not null and not public.td_can_manage_requests() then
    new.deadhead_km := old.deadhead_km;
    new.accepted_at := old.accepted_at;
  end if;
  return new;
end $fn$;
revoke execute on function public.td_record_bin_acceptance() from public, anon, authenticated;
drop trigger if exists ac_td_record_bin_acceptance on public.digital_bins;
create trigger ac_td_record_bin_acceptance before update on public.digital_bins
  for each row execute function public.td_record_bin_acceptance();

-- 2. The collector's share of a standard bin, from what the client paid (never
--    above the bin's fee): GH₵1 request fee to TrashDrop; 75% of the urgent
--    surcharge; 85/87/89/92% of the base by distance (87% if unknown).
create or replace function public.td_bin_collector_share(p_paid numeric, p_fee numeric, p_urgent boolean, p_km numeric)
returns numeric language sql immutable set search_path = public as $fn$
  with s as (select greatest(0, least(coalesce(p_paid, 0), coalesce(p_fee, 0)) - 1) as shareable),
  parts as (select case when p_urgent then shareable / 1.30 else shareable end as base,
                   case when p_urgent then shareable - shareable / 1.30 else 0 end as urgent from s)
  select round(base * case when p_km is null or p_km <= 0 then 0.87
                           when p_km <= 2 then 0.85 when p_km <= 5 then 0.87
                           when p_km <= 10 then 0.89 else 0.92 end
               + urgent * 0.75, 2)
  from parts
$fn$;

-- 3. Payment records: the database sets the shares of a standard bin (it only
--    capped them before). Promotional bins and updates are unchanged.
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
  paid numeric;
begin
  if me is null or public.td_can_manage_requests() then
    return new;  -- service key (gateway webhook, payout functions) or staff
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
