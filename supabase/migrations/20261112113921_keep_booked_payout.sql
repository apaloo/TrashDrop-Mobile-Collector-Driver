-- Collector payouts (protected; owner's written approval 2026-11-12: "Apply
-- the payout fix? yes"). A digital bin's price and payout are set by the
-- database when it is booked (docs/DIGITAL_BIN_PRICING.md). When a collector
-- updates their bin (accept, collect, dispose), those fields keep their booked
-- values; the rest of the update goes through, so the collector app works
-- unchanged. Server functions (service key) and staff are unaffected.
-- Specification: docs/COLLECTOR_PAYOUTS.md (household repository).
create or replace function public.td_keep_booked_payout() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if auth.uid() is null or public.td_can_manage_requests() then return new; end if;
  new.fee := old.fee;  new.is_promotional := old.is_promotional;  new.is_urgent := old.is_urgent;
  new.bag_count := old.bag_count;  new.bin_size_liters := old.bin_size_liters;
  new.collector_core_payout := old.collector_core_payout;  new.collector_urgent_payout := old.collector_urgent_payout;
  new.collector_distance_payout := old.collector_distance_payout;  new.collector_surge_payout := old.collector_surge_payout;
  new.collector_recyclables_payout := old.collector_recyclables_payout;  new.collector_loyalty_cashback := old.collector_loyalty_cashback;
  new.collector_tips := old.collector_tips;  new.collector_total_payout := old.collector_total_payout;
  return new;
end $fn$;
revoke execute on function public.td_keep_booked_payout() from public, anon, authenticated;
drop trigger if exists ab_td_keep_booked_payout on public.digital_bins;
create trigger ab_td_keep_booked_payout before update on public.digital_bins
  for each row execute function public.td_keep_booked_payout();
