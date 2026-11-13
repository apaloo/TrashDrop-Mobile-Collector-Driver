// Protected payout display (owner-approved 2026-11-13): the Earnings
// breakdown and the job card show what the database pays. Expected figures
// come from the production function td_bin_collector_share (2026-11-13).
import { binEarningBuckets, estimateBinEarning } from '../binEarnings';

const bin = (over = {}) => ({ id: 'b', fee: 26, is_promotional: false, is_urgent: false, deadhead_km: null, ...over });

describe('binEarningBuckets (Earnings breakdown)', () => {
  test('uses the share the database recorded, not the payout columns on the bin', () => {
    // A bin disposed before 2026-11-12: the app stored 21.97 with a 0.22 cashback
    const old = bin({ collector_core_payout: 21.75, collector_total_payout: 21.97, collector_loyalty_cashback: 0.22, collector_distance_payout: 3 });
    expect(binEarningBuckets(old, { totalBill: 26, collectorShare: '21.75' })).toEqual({
      core: 21.75, urgent: 0, distance: 0, surge: 0, tips: 0, recyclables: 0, loyalty: 0,
    });
  });

  test('splits an urgent bin into base and urgent parts', () => {
    const b = binEarningBuckets(bin({ fee: 27, is_urgent: true, deadhead_km: 1 }), { totalBill: 27, collectorShare: 21.5 });
    expect(b.urgent).toBe(4.5);
    expect(b.core).toBe(17);
  });

  test('a failed or unpaid payment recorded as 0 earns 0', () => {
    expect(binEarningBuckets(bin(), { totalBill: 1, collectorShare: 0 }).core).toBe(0);
  });

  test('without a recorded share, the database\'s formula (amount counted up to the fee)', () => {
    expect(binEarningBuckets(bin(), { totalBill: 30 }).core).toBe(21.75);
  });

  test('tips are kept; promotional bins earn their booked payout', () => {
    expect(binEarningBuckets(bin({ collector_tips: 2 }), { totalBill: 26, collectorShare: 21.75 }).tips).toBe(2);
    expect(binEarningBuckets(bin({ is_promotional: true, fee: 22, collector_core_payout: 40 }), { totalBill: 22, collectorShare: 40 }).core).toBe(40);
  });
});

describe('estimateBinEarning (job card)', () => {
  test.each([
    ['the specification\'s example: 1.5 km', { distanceValue: 1.5 }, 21.25, 85],
    ['distance unknown (no location)', { distanceValue: 999999 }, 21.75, 87],
    ['7 km away now', { distanceValue: 7 }, 22.25, 89],
    ['12 km recorded at accept wins over the current distance', { deadhead_km: 12, distanceValue: 1 }, 23, 92],
    ['urgent, 8 km', { fee: 27, is_urgent: true, distanceValue: 8 }, 22.3, 89],
  ])('%s', (_label, over, amount, pct) => {
    const e = estimateBinEarning(bin(over));
    expect(e.amount).toBeCloseTo(amount, 2);
    expect(e.sharePercent).toBe(pct);
  });

  test('never above the booked payout; never the client\'s whole fee', () => {
    expect(estimateBinEarning(bin({ fee: 19, collector_total_payout: 18, collector_core_payout: 18 })).amount).toBe(15.66);
    expect(estimateBinEarning(bin({ deadhead_km: 12, collector_total_payout: 20 })).amount).toBe(20);
  });

  test('says where the distance came from', () => {
    expect(estimateBinEarning(bin({ deadhead_km: 3 })).kmSource).toBe('recorded');
    expect(estimateBinEarning(bin({ distanceValue: 3 })).kmSource).toBe('current');
    expect(estimateBinEarning(bin()).kmSource).toBeNull();
  });
});
