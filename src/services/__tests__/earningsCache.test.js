// The Earnings page's copy of the collector's earnings on the phone
// (getEarningsWithCache): when it is used, when it is refreshed, and what a
// collector on a weak or no connection sees. The figures themselves are
// worked out by getEarningsData (other earnings*.test.js files).
import { createEarningsService } from '../earningsService';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));
jest.mock('../trendiPayService', () => ({}));
jest.mock('../supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));

const KEY = 'trashdrop_earnings_cache_c1';
const MIN = 60 * 1000;
const NOW = new Date('2026-11-13T12:00:00Z').getTime();
let online;
const store = (data, ageMs) => localStorage.setItem(KEY, JSON.stringify({ data, timestamp: NOW - ageMs, version: '1.0', collectorId: 'c1' }));
const stored = () => JSON.parse(localStorage.getItem(KEY));

const service = (fetchResult) => {
  const s = createEarningsService('c1');
  s.getEarningsData = jest.fn(typeof fetchResult === 'function' ? fetchResult : async () => fetchResult);
  return s;
};
const FRESH = { success: true, data: { stats: { totalEarnings: 120, withdrawableEarnings: 80 }, transactions: [{ id: 't1' }], chartData: { w: 1 } } };

beforeEach(() => {
  localStorage.clear();
  online = true;
  jest.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
});
afterEach(() => jest.restoreAllMocks());

describe('getEarningsWithCache', () => {
  it('a copy under 5 minutes old is shown without asking the database', async () => {
    store({ totalEarnings: 100 }, 2 * MIN);
    const s = service(FRESH);
    expect(await s.getEarningsWithCache()).toEqual({ success: true, data: { totalEarnings: 100 }, fromCache: true, cacheAge: 2 * MIN });
    expect(s.getEarningsData).not.toHaveBeenCalled();
  });

  it('an older copy is fetched again online; the stats are flattened and stored', async () => {
    store({ totalEarnings: 100 }, 6 * MIN);
    const s = service(FRESH);
    const r = await s.getEarningsWithCache();
    expect(r).toMatchObject({ success: true, fromCache: false });
    expect(r.data).toEqual({ totalEarnings: 120, withdrawableEarnings: 80, transactions: [{ id: 't1' }], chartData: { w: 1 }, _source: 'legacy' });
    expect(stored()).toMatchObject({ data: r.data, timestamp: NOW, collectorId: 'c1' });
  });

  it('"Refresh" always asks the database', async () => {
    store({ totalEarnings: 100 }, 1 * MIN);
    const s = service(FRESH);
    expect((await s.getEarningsWithCache({ forceRefresh: true })).data.totalEarnings).toBe(120);
    expect(s.getEarningsData).toHaveBeenCalledTimes(1);
  });

  it('offline, a copy up to 24 hours old is shown', async () => {
    online = false;
    store({ totalEarnings: 100 }, 23 * 60 * MIN);
    const s = service(FRESH);
    expect(await s.getEarningsWithCache()).toMatchObject({ success: true, fromCache: true, data: { totalEarnings: 100 } });
    expect(s.getEarningsData).not.toHaveBeenCalled();
  });

  it('offline with no usable copy says so instead of trying', async () => {
    online = false;
    store({ totalEarnings: 100 }, 25 * 60 * MIN);
    const s = service(FRESH);
    expect(await s.getEarningsWithCache()).toEqual({
      success: false, error: 'You are offline and no cached earnings data is available.', fromCache: false, isOffline: true,
    });
    expect(s.getEarningsData).not.toHaveBeenCalled();
  });

  it('a weak connection (online, but the fetch fails) shows the last copy from today, marked as having failed', async () => {
    store({ totalEarnings: 100 }, 3 * 60 * MIN);
    const s = service(async () => { throw new Error('Failed to fetch'); });
    expect(await s.getEarningsWithCache()).toEqual({
      success: true, data: { totalEarnings: 100 }, fromCache: true, cacheAge: 3 * 60 * MIN, hadError: true,
    });
  });

  it('a failed fetch with no copy from the last 24 hours is an error', async () => {
    store({ totalEarnings: 100 }, 25 * 60 * MIN);
    const s = service({ success: false, error: 'permission denied' });
    expect(await s.getEarningsWithCache()).toEqual({ success: false, error: 'permission denied', fromCache: false });
  });

  it('a damaged copy is thrown away and the earnings fetched', async () => {
    localStorage.setItem(KEY, '{not json');
    const s = service(FRESH);
    expect((await s.getEarningsWithCache()).fromCache).toBe(false);
    expect(stored().data.totalEarnings).toBe(120);
  });

  it('stores at most the 100 latest transactions', async () => {
    const transactions = Array.from({ length: 150 }, (_, i) => ({ id: `t${i}` }));
    const s = service({ success: true, data: { stats: {}, transactions } });
    await s.getEarningsWithCache({ forceRefresh: true });
    expect(stored().data.transactions).toHaveLength(100);
    expect(stored().data.transactions[0].id).toBe('t0');
  });

  it("one collector's copy is never shown to another on the same phone", async () => {
    store({ totalEarnings: 100 }, 1 * MIN);
    const other = createEarningsService('c2');
    other.getEarningsData = jest.fn(async () => FRESH);
    expect((await other.getEarningsWithCache()).fromCache).toBe(false);
  });
});
