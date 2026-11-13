// What the Earnings page shows for a pickup request (prepaid bags). The
// database pays it: 100% of the scanned bags' unit prices plus tips, stored
// in collector_total_payout with payout_breakdown.model 'prepaid_bags...'
// (finalize_pickup_request_payout; docs/COLLECTOR_PAYOUTS.md in the household
// repository). The app shows that stored figure; these tests pin it, and
// what is shown before anything is stored and for older records.
import { calculateCollectorEarnings, calculatePlatformEarnings } from '../earningsService';

jest.mock('../../utils/logger', () => ({ logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('../trendiPayService', () => ({}));
jest.mock('../supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));

describe('calculateCollectorEarnings (pickup requests)', () => {
  it('a prepaid-bag job shows exactly the payout the database stored', () => {
    expect(calculateCollectorEarnings({ fee: 2.5, bag_count: 4, collector_total_payout: '11.00', payout_breakdown: { model: 'prepaid_bags' } })).toBe(11);
    expect(calculateCollectorEarnings({ fee: 2.5, collector_total_payout: 12.5, payout_breakdown: { model: 'prepaid_bags_v2' } })).toBe(12.5);
    // even when the stored payout is the full fee or more (100% of the bags, plus tips)
    expect(calculateCollectorEarnings({ fee: 10, collector_total_payout: 13, payout_breakdown: { model: 'prepaid_bags' } })).toBe(13);
    expect(calculateCollectorEarnings({ collector_total_payout: null, payout_breakdown: { model: 'prepaid_bags' } })).toBe(0);
  });

  it('before any bag is scanned: the unit price for each requested bag, plus tips, nothing taken off', () => {
    expect(calculateCollectorEarnings({ fee: '2.50', bag_count: 4, collector_total_payout: null })).toBe(10);
    expect(calculateCollectorEarnings({ fee: 2.5, estimated_volume: '3', bag_count: 9, collector_tips: '1.5' })).toBe(9);
    expect(calculateCollectorEarnings({ fee: 2.5 })).toBe(2.5); // at least one bag
    expect(calculateCollectorEarnings({ fee: null, bag_count: 2 })).toBe(0);
  });

  it('a stored payout below the fee is shown as stored', () => {
    expect(calculateCollectorEarnings({ fee: 20, collector_total_payout: 15.6 })).toBe(15.6);
    expect(calculateCollectorEarnings({ fee: 0, collector_total_payout: 4 })).toBe(4);
  });

  it('older records (stored payout at or above the fee, no model) are recomputed with the sharing rules', () => {
    // fee 21 - request fee 1 = 20 shared; no distance: 87%
    expect(calculateCollectorEarnings({ fee: 21, collector_total_payout: 21 })).toBeCloseTo(17.4, 6);
    // 2 km or less: 85%; plus 75% of a GHS 4 urgent surcharge, tips and 60% of recyclables
    expect(calculateCollectorEarnings({
      fee: 21, collector_total_payout: 30, deadhead_km: 1.5, urgent_enabled: true, urgent_amount: 4, tips: 2, recycler_gross_payout: 5,
    })).toBeCloseTo(20 * 0.85 + 3 + 2 + 3, 6);
    expect(calculateCollectorEarnings({ fee: 1, collector_total_payout: 1 })).toBe(0); // only the request fee
  });
});

describe('calculatePlatformEarnings (pickup requests)', () => {
  it('the request fee always goes to the platform; with stored payouts, the rest of each bucket', () => {
    const r = calculatePlatformEarnings({
      fee: 21, collector_total_payout: 18, collector_core_payout: 17, urgent_amount: 4, collector_urgent_payout: 3,
    });
    expect(r).toEqual({ platformCore: 3, platformUrg: 1, platformSurge: 0, platformRecyclables: 0, requestFee: 1, total: 5 });
  });

  it('older records: the platform keeps the part of the base the collector does not, 25% of urgent, 15% of recyclables', () => {
    const r = calculatePlatformEarnings({ fee: 21, deadhead_km: 1, urgent_enabled: true, urgent_amount: 4, recycler_gross_payout: 10 });
    expect(r.platformCore).toBeCloseTo(3, 6);
    expect(r).toMatchObject({ platformUrg: 1, platformRecyclables: 1.5, requestFee: 1 });
    expect(r.total).toBeCloseTo(6.5, 6);
    expect(calculatePlatformEarnings({ fee: 1 })).toEqual({ platformCore: 0, platformUrg: 0, platformSurge: 0, platformRecyclables: 0, requestFee: 1, total: 1 });
  });

  // TD64 (owner-approved 2026-11-13): for a prepaid-bag job TrashDrop counts
  // only what the database recorded (platform_share, 0 for prepaid bags), so
  // the collector's 100% and TrashDrop's share never add up to more than the job
  it('a prepaid-bag job: TrashDrop counts only what the database recorded, no request fee', () => {
    const job = { fee: 12.5, bag_count: 5, collector_total_payout: 12.5, platform_share: 0, payout_breakdown: { model: 'prepaid_bags' } };
    expect(calculatePlatformEarnings(job)).toEqual({ platformCore: 0, platformUrg: 0, platformSurge: 0, platformRecyclables: 0, requestFee: 0, total: 0 });
    expect(calculateCollectorEarnings(job) + calculatePlatformEarnings(job).total).toBe(12.5);
    // whatever the database recorded, as recorded
    expect(calculatePlatformEarnings({ ...job, platform_share: '0.75', payout_breakdown: { model: 'prepaid_bags_v2' } }).total).toBe(0.75);
    expect(calculatePlatformEarnings({ ...job, platform_share: null }).total).toBe(0);
  });
});
