// Illegal dumping cleanups in a collector's earnings (protected collector
// payouts; owner's decision 2026-11-12). A cleanup TrashDrop pays is
// withdrawable once disposed; one an MMDA assigned is paid by the MMDA to the
// team directly and only recorded on TrashDrop, so it is never withdrawable
// here (same rule as td_withdrawable_items part C).
import { createEarningsService } from '../earningsService';
import { supabase } from '../supabase';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));
jest.mock('../trendiPayService', () => ({}));
jest.mock('../supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));

const rowsFor = (tables) => (table) => {
  const result = { data: tables[table] || [], error: null };
  const builder = new Proxy({}, {
    get: (_, prop) => (prop === 'then' ? (resolve) => resolve(result) : () => builder),
  });
  return builder;
};

const cleanup = (id, payment, feePaidBy, status = 'disposed') => ({
  id, payment, original_status: status, fee_paid_by: feePaidBy, location: 'Madina', disposed_at: '2026-11-12T10:00:00Z', updated_at: '2026-11-12T10:00:00Z',
});

const load = async (cleanups) => {
  supabase.from.mockImplementation(rowsFor({ collector_assignments_view: cleanups }));
  const { data } = await createEarningsService('collector-1').getEarningsData();
  return data.stats;
};

beforeEach(() => jest.clearAllMocks());

it('a cleanup TrashDrop pays is withdrawable once disposed', async () => {
  const stats = await load([cleanup('c1', 50, 'trashdrop')]);
  expect(stats.dumpingCleanupEarnings).toBe(50);
  expect(stats.withdrawableEarnings).toBe(50);
  expect(stats.cleanupPaidByMmdaEarnings).toBe(0);
});

it('a cleanup an MMDA assigned is recorded but never withdrawable here', async () => {
  const stats = await load([cleanup('c1', 50, 'trashdrop'), cleanup('c2', 40, 'mmda')]);
  expect(stats.dumpingCleanupEarnings).toBe(90);
  expect(stats.withdrawableEarnings).toBe(50);
  expect(stats.cleanupPaidByMmdaEarnings).toBe(40);
});

it('older rows without fee_paid_by count as paid by TrashDrop', async () => {
  const stats = await load([cleanup('c1', 30, undefined)]);
  expect(stats.withdrawableEarnings).toBe(30);
});
