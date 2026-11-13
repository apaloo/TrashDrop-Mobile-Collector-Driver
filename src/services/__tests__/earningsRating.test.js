// The collector's rating on the Earnings page: the average of households'
// ratings, kept by the database on the collector's own profile (household
// repository issue #186). Collectors never see individual ratings or comments.
import { createEarningsService } from '../earningsService';
import { supabase } from '../supabase';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));
jest.mock('../trendiPayService', () => ({}));
jest.mock('../supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));

let calls;
const profile = (result) => (table) => {
  calls.push(['from', table]);
  const q = {
    select: (cols) => { calls.push(['select', cols]); return q; },
    eq: (col, val) => { calls.push(['eq', col, val]); return q; },
    maybeSingle: () => Promise.resolve(result),
  };
  return q;
};

beforeEach(() => { calls = []; jest.clearAllMocks(); });

it('reads only the average from the collector\'s own profile', async () => {
  supabase.from.mockImplementation(profile({ data: { rating: '4.50' }, error: null }));
  expect(await createEarningsService('user-1').getMyRating()).toBe(4.5);
  expect(calls).toEqual([['from', 'collector_profiles'], ['select', 'rating'], ['eq', 'user_id', 'user-1']]);
});

it.each([
  ['nobody has rated yet (0.00)', { data: { rating: '0.00' }, error: null }],
  ['no profile', { data: null, error: null }],
  ['the read failed', { data: null, error: { message: 'network' } }],
  ['an impossible value', { data: { rating: '7' }, error: null }],
])('%s: 0, shown as "No ratings yet"', async (_label, result) => {
  supabase.from.mockImplementation(profile(result));
  expect(await createEarningsService('user-1').getMyRating()).toBe(0);
});

it('never reads individual ratings', async () => {
  supabase.from.mockImplementation(profile({ data: { rating: '3.00' }, error: null }));
  await createEarningsService('user-1').getMyRating();
  expect(calls.some(([m, t]) => m === 'from' && t === 'job_ratings')).toBe(false);
});
