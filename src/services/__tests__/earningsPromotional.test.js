import { createEarningsService } from '../earningsService';
import { supabase } from '../supabase';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));
jest.mock('../trendiPayService', () => ({}));
jest.mock('../supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));

// A query builder that resolves to the rows given for its table
const rowsFor = (tables) => (table) => {
  const result = { data: tables[table] || [], error: null };
  const builder = new Proxy({}, {
    get: (_, prop) => (prop === 'then'
      ? (resolve) => resolve(result)
      : () => builder),
  });
  return builder;
};

const COLLECTOR = 'collector-1';

// Gettina's bin: promotional 240 L, client paid GHS 22 cash, payout GHS 40,
// TrashDrop's top-up GHS 18 (bin_payments as stored at collection)
const promoBin = {
  id: 'bin-promo', collector_id: COLLECTOR, status: 'disposed', is_promotional: true,
  bin_size_liters: 240, bag_count: 1, fee: 22, collector_core_payout: 40, updated_at: '2026-10-24T10:00:00Z',
};
const promoPayment = (mode) => ({
  digital_bin_id: 'bin-promo', payment_mode: mode, total_bill: '22.00', collector_share: '40',
  platform_share: '0', platform_subsidy: '18.00', is_promotional: true, type: 'collection',
  status: 'success', created_at: '2026-10-24T09:00:00Z',
});

const load = async (payment, extraBins = [], extraPayments = []) => {
  supabase.from.mockImplementation(rowsFor({
    digital_bins: [promoBin, ...extraBins],
    bin_payments: [payment, ...extraPayments],
  }));
  const { data } = await createEarningsService(COLLECTOR).getEarningsData();
  return data.stats;
};

beforeEach(() => jest.clearAllMocks());

describe('earnings for a promotional bin paid in cash', () => {
  it('counts the promotional payout, no platform fee, and the cash the client handed over', async () => {
    const stats = await load(promoPayment('cash'));
    expect(stats.totalEarnings).toBe(40);
    expect(stats.platformEarnings).toBe(0);
    expect(stats.grossRevenue).toBe(22);
    expect(stats.promoSubsidy).toBe(18);
    expect(stats.paymentModeBreakdown.cash.collected).toBe(22);
    expect(stats.collectorSharePercent).toBe(100);
    expect(stats.platformSharePercent).toBe(0);
  });

  it('makes TrashDrop\'s top-up withdrawable (the client\'s cash is already with the collector)', async () => {
    const stats = await load(promoPayment('cash'));
    expect(stats.promoCashSubsidyOwed).toBe(18);
    expect(stats.withdrawableEarnings).toBe(18);
  });
});

describe('earnings for a promotional bin paid by MoMo', () => {
  it('withdraws the whole payout once, with no separate top-up', async () => {
    const stats = await load(promoPayment('momo'));
    expect(stats.totalEarnings).toBe(40);
    expect(stats.promoCashSubsidyOwed).toBe(0);
    expect(stats.withdrawableEarnings).toBe(40);
    expect(stats.paymentModeBreakdown.digital.collected).toBe(22);
  });
});

describe('a standard bin whose stored share is above its bill', () => {
  it('is still treated as a bad legacy record (0 earnings)', async () => {
    const legacyBin = { id: 'bin-legacy', collector_id: COLLECTOR, status: 'disposed', is_promotional: false, fee: 20, updated_at: '2026-10-24T10:00:00Z' };
    const legacyPayment = {
      digital_bin_id: 'bin-legacy', payment_mode: 'momo', total_bill: '20.00', collector_share: '25',
      platform_share: '0', platform_subsidy: '0', is_promotional: false, type: 'collection',
      status: 'success', created_at: '2026-10-24T09:00:00Z',
    };
    const stats = await load(promoPayment('cash'), [legacyBin], [legacyPayment]);
    expect(stats.digitalBinEarnings).toBe(40); // the promotional bin only
  });
});
