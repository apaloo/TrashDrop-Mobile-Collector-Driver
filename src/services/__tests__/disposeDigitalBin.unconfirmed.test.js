// Disposing a digital bin (protected payout code; TD52, approved by the owner
// 2026-11-12). Without a readable payment record the bin counts as
// unconfirmed: the collector is shown GH₵0, never the full fee, and the
// disposal itself still goes ahead. What is owed is decided by the database
// (td_keep_booked_payout, td_withdrawable_items), not by these figures.
import { disposeDigitalBin } from '../disposalService';
import { supabase } from '../supabase';
import { logger } from '../../utils/logger';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../supabase', () => ({ supabase: { from: jest.fn() } }));

const COLLECTOR = 'c-1';
const BIN = {
  id: 'bin-1', status: 'collecting', collector_id: COLLECTOR, user_id: 'u-1', fee: 50,
  is_promotional: false, is_urgent: false, bin_size_liters: 240, bag_count: 1, deadhead_km: 0,
  collector_core_payout: 43.5, created_at: '2026-11-12T08:00:00Z',
};

let payment; // what the bin_payments read returns: { data, error }
let binUpdates;

beforeEach(() => {
  jest.clearAllMocks();
  binUpdates = [];
  payment = { data: null, error: null };
  supabase.from.mockImplementation((table) => {
    const own = [];
    const finish = () => {
      if (table === 'digital_bins' && own.some((c) => c[0] === 'update')) return { error: null };
      if (table === 'digital_bins') return { data: BIN, error: null };
      if (table === 'bin_payments') return payment;
      if (table === 'collector_tips') return { data: [], error: null };
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

it('a bin without a payment record is disposed, showing GH₵0', async () => {
  const res = await disposeDigitalBin('bin-1', COLLECTOR, 'site-1', 'Kpone');
  expect(res.success).toBe(true);
  expect(res.payoutBreakdown.collector_total_payout).toBe(0);
  expect(binUpdates).toHaveLength(1);
  expect(binUpdates[0]).toMatchObject({ status: 'disposed', disposal_site_id: 'site-1' });
});

it('a payment record that cannot be read is treated the same way, and logged', async () => {
  payment = { data: null, error: { message: 'network' } };
  const res = await disposeDigitalBin('bin-1', COLLECTOR);
  expect(res.success).toBe(true);
  expect(res.payoutBreakdown.collector_total_payout).toBe(0);
  expect(binUpdates[0]).toMatchObject({ status: 'disposed' });
  expect(logger.error).toHaveBeenCalledWith(expect.stringMatching(/treating it as unconfirmed/), expect.objectContaining({ binId: 'bin-1', message: 'network' }));
});

it('a confirmed MoMo payment still shows the payout', async () => {
  payment = { data: { id: 'pay-1', payment_mode: 'momo', status: 'success', total_bill: 50 }, error: null };
  const res = await disposeDigitalBin('bin-1', COLLECTOR);
  expect(res.success).toBe(true);
  expect(res.payoutBreakdown.collector_total_payout).toBeGreaterThan(0);
});

// Owner's decision 2026-11-12: a client MoMo payment still pending shows the
// expected payout, marked pending (nothing is withdrawable until confirmed).
it('a pending MoMo payment shows the expected payout, marked pending', async () => {
  payment = { data: { id: 'pay-1', payment_mode: 'momo', status: 'pending', total_bill: 50 }, error: null };
  const res = await disposeDigitalBin('bin-1', COLLECTOR);
  expect(res.success).toBe(true);
  expect(res.paymentPending).toBe(true);
  expect(res.payoutBreakdown.collector_total_payout).toBeGreaterThan(0);
  expect(binUpdates[0]).toMatchObject({ status: 'disposed' });
});

it.each([
  ['a confirmed MoMo payment', { data: { id: 'pay-1', payment_mode: 'momo', status: 'success', total_bill: 50 }, error: null }],
  ['cash', { data: { id: 'pay-1', payment_mode: 'cash', status: 'pending', total_bill: 50 }, error: null }],
  ['no payment record', { data: null, error: null }],
])('%s is not marked pending', async (_label, p) => {
  payment = p;
  const res = await disposeDigitalBin('bin-1', COLLECTOR);
  expect(res.paymentPending).toBe(false);
});
