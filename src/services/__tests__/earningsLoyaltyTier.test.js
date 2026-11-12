// The collector's loyalty tier on the Earnings page (listed with the protected
// collector payout code). No tier row for this month is normal: the page shows
// Silver. The lookup asks for at most one row, so "no row" is not an HTTP 406
// in the production logs (owner-approved 2026-11-12).
import { createEarningsService } from '../earningsService';
import { supabase } from '../supabase';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));
jest.mock('../trendiPayService', () => ({}));
jest.mock('../supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));

let calls;
const tierQuery = (result) => (table) => {
  calls.push(['from', table]);
  const q = {
    select: () => q,
    eq: (col, val) => { calls.push(['eq', col, val]); return q; },
    maybeSingle: () => { calls.push(['maybeSingle']); return Promise.resolve(result); },
    single: () => { calls.push(['single']); return Promise.resolve(result.data ? result : { data: null, error: { code: 'PGRST116' } }); },
  };
  return q;
};

beforeEach(() => { calls = []; jest.clearAllMocks(); });

it('no tier row this month: Silver, 1% cashback, GHS 100 cap, all of it remaining', async () => {
  supabase.from.mockImplementation(tierQuery({ data: null, error: null }));
  const r = await createEarningsService('collector-1').getLoyaltyTier();
  expect(r.success).toBe(true);
  expect(r.data).toMatchObject({ tier: 'Silver', cashback_rate: 0.01, monthly_cap: 100, cashback_earned: 0, remaining: 100 });
  expect(calls).toContainEqual(['from', 'collector_loyalty_tiers']);
  expect(calls).toContainEqual(['eq', 'collector_id', 'collector-1']);
});

it("a stored tier is shown with what's left of its cap", async () => {
  supabase.from.mockImplementation(tierQuery({ data: { tier: 'Gold', cashback_rate: 0.03, monthly_cap: 300, cashback_earned: 120 }, error: null }));
  const r = await createEarningsService('collector-1').getLoyaltyTier();
  expect(r.data).toMatchObject({ tier: 'Gold', remaining: 180 });
});

it('asks for at most one row, so "no tier yet" is not an error in the logs', async () => {
  supabase.from.mockImplementation(tierQuery({ data: null, error: null }));
  await createEarningsService('collector-1').getLoyaltyTier();
  expect(calls).toContainEqual(['maybeSingle']);
  expect(calls).not.toContainEqual(['single']);
});
