// Route data for the route-optimisation screen. A collector's in-progress
// work (accepted, en route, arrived) is read for that collector only. A
// "diagnostic" used to read every collector's in-progress pickups and bins
// and log their ids and collector ids (logger.info prints in production),
// and its digital_bins query named a column that doesn't exist.
import { AnalyticsService } from '../analyticsService';
import { supabase } from '../supabase';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../supabase', () => ({ supabase: { from: jest.fn() } }));

const COLLECTOR = '11111111-1111-4111-8111-111111111111';
const IN_PROGRESS = ['accepted', 'en_route', 'arrived'];

// Records every query as { table, calls: [[method, ...args]] }; every query returns no rows
let queries;
beforeEach(() => {
  queries = [];
  supabase.from.mockImplementation((table) => {
    const q = { table, calls: [] };
    queries.push(q);
    const builder = new Proxy({}, {
      get: (_, method) => {
        if (method === 'then') return (resolve) => resolve({ data: [], error: null });
        return (...args) => { q.calls.push([method, ...args]); return builder; };
      },
    });
    return builder;
  });
});

const has = (q, method, ...args) => q.calls.some((c) => c[0] === method && args.every((a, i) => JSON.stringify(c[i + 1]) === JSON.stringify(a)));

it("reads in-progress work for this collector only", async () => {
  await new AnalyticsService(COLLECTOR).getCurrentRouteData();
  const inProgress = queries.filter((q) => has(q, 'in', 'status', IN_PROGRESS));
  expect(inProgress.length).toBeGreaterThan(0);
  for (const q of inProgress) {
    expect(has(q, 'eq', 'collector_id', COLLECTOR)).toBe(true);
  }
});

it('never selects digital_bins.location (the column does not exist)', async () => {
  await new AnalyticsService(COLLECTOR).getCurrentRouteData();
  for (const q of queries.filter((x) => x.table === 'digital_bins')) {
    const selected = q.calls.filter((c) => c[0] === 'select').map((c) => String(c[1]));
    for (const columns of selected) {
      expect(columns.split(',').map((c) => c.trim())).not.toContain('location');
    }
  }
});
