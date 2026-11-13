// Protected payout display (owner-approved 2026-11-13). What a collector is
// shown when disposing a standard digital bin must be what the database
// records as their share (td_bin_collector_share, applied to the payment;
// docs/COLLECTOR_PAYOUTS.md in the household repository). Every expected
// figure below was produced by the production function itself on 2026-11-13.
// The app used to add a 1% loyalty cashback, a distance bonus and a surge
// share that nothing pays.
import { disposeDigitalBin } from '../disposalService';
import { supabase } from '../supabase';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../supabase', () => ({ supabase: { from: jest.fn() } }));

const COLLECTOR = 'c-1';
let bin;
let payment;
let tips;
let binUpdates;

const standardBin = (over = {}) => ({
  id: 'bin-1', status: 'collecting', collector_id: COLLECTOR, user_id: 'u-1', fee: 26,
  is_promotional: false, is_urgent: false, bin_size_liters: 120, bag_count: 1, deadhead_km: null,
  collector_core_payout: 25, collector_total_payout: 25, // the booked payout (ceiling)
  created_at: '2026-11-13T08:00:00Z', ...over,
});
const paid = (amount, over = {}) => ({ data: { id: 'pay-1', payment_mode: 'momo', status: 'success', total_bill: amount, ...over }, error: null });

beforeEach(() => {
  jest.clearAllMocks();
  binUpdates = [];
  tips = [];
  supabase.from.mockImplementation((table) => {
    const own = [];
    const finish = () => {
      if (table === 'digital_bins' && own.some((c) => c[0] === 'update')) return { error: null };
      if (table === 'digital_bins') return { data: bin, error: null };
      if (table === 'bin_payments') return payment;
      if (table === 'collector_tips') return { data: tips, error: null };
      return { data: null, error: null };
    };
    const builder = new Proxy({}, {
      get: (_, method) => {
        if (method === 'then') return (resolve, reject) => Promise.resolve(finish()).then(resolve, reject);
        return (...args) => {
          own.push([method, ...args]);
          if (table === 'digital_bins' && method === 'update') binUpdates.push(args[0]);
          return method === 'single' || method === 'maybeSingle' ? Promise.resolve(finish()) : builder;
        };
      },
    });
    return builder;
  });
});

const shown = async () => (await disposeDigitalBin('bin-1', COLLECTOR)).payoutBreakdown;

// [label, bin overrides, amount paid, td_bin_collector_share in production]
const CASES = [
  ['the specification\'s example: GH₵26, 1.5 km', { deadhead_km: 1.5 }, 26, 21.25],
  ['distance unknown: 87%', {}, 26, 21.75],
  ['3 km: 87%', { deadhead_km: 3 }, 26, 21.75],
  ['7 km: 89%', { deadhead_km: 7 }, 26, 22.25],
  ['12 km: 92%', { deadhead_km: 12 }, 26, 23.0],
  ['urgent, 1 km: 85% of the base + 75% of the surcharge', { fee: 27, is_urgent: true, deadhead_km: 1, collector_total_payout: 26 }, 27, 21.5],
  ['urgent, 8 km: no distance bonus', { fee: 27, is_urgent: true, deadhead_km: 8, collector_total_payout: 26 }, 27, 22.3],
  ['paid more than the fee: counted up to the fee', {}, 30, 21.75],
  ['paid less than the fee', {}, 21, 17.4],
];

describe('the payout shown at disposal is the database\'s figure', () => {
  test.each(CASES)('%s', async (_label, over, amount, expected) => {
    bin = standardBin(over);
    payment = paid(amount);
    const b = await shown();
    expect(b.collector_total_payout).toBeCloseTo(expected, 2);
    expect(b.collector_core_payout + b.collector_urgent_payout).toBeCloseTo(expected, 2);
  });

  test('no loyalty cashback, distance bonus or surge share, whatever the bin says', async () => {
    bin = standardBin({ deadhead_km: 8, is_urgent: true, fee: 27, collector_total_payout: 26, surge_multiplier: 1.5, loyalty_rate: 0.03, recycler_gross_payout: 10 });
    payment = paid(27);
    const b = await shown();
    expect(b).toMatchObject({
      collector_loyalty_cashback: 0, collector_distance_payout: 0, collector_surge_payout: 0, collector_recyclables_payout: 0,
    });
    expect(b.collector_total_payout).toBeCloseTo(22.3, 2);
  });

  test('never more than the booked payout', async () => {
    bin = standardBin({ deadhead_km: 12, collector_total_payout: 20 });
    payment = paid(26);
    expect((await shown()).collector_total_payout).toBe(20);
  });

  test('confirmed tips are added on top', async () => {
    bin = standardBin({ deadhead_km: 1.5 });
    payment = paid(26);
    tips = [{ amount: 3 }, { amount: '2.5' }];
    const b = await shown();
    expect(b.collector_tips).toBe(5.5);
    expect(b.collector_total_payout).toBeCloseTo(26.75, 2);
  });

  test('the platform keeps the rest of what was counted', async () => {
    bin = standardBin({ deadhead_km: 1.5 });
    payment = paid(26);
    expect((await shown()).platform_share).toBeCloseTo(4.75, 2); // the specification's example
  });

  test('the disposal sends no payout figures (the database keeps its own)', async () => {
    bin = standardBin({ deadhead_km: 1.5 });
    payment = paid(26);
    await disposeDigitalBin('bin-1', COLLECTOR, 'site-1');
    expect(binUpdates).toHaveLength(1);
    expect(Object.keys(binUpdates[0]).sort()).toEqual(['disposal_site_id', 'disposed_at', 'status', 'updated_at']);
  });

  test('promotional bins still show their booked promotional payout', async () => {
    bin = standardBin({ is_promotional: true, fee: 22, bin_size_liters: 120, bag_count: 1, collector_core_payout: 40, collector_total_payout: 40 });
    payment = paid(22);
    expect((await shown()).collector_total_payout).toBe(40);
  });
});
