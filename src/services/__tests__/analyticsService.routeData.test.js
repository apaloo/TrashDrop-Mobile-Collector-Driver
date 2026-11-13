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

// Supabase returns a geography column as EWKB hex (here made by PostGIS for
// made-up points). Until 2026-11-13 the route screen couldn't read it and left
// every such pickup and digital bin off the route.
describe('positions as Supabase returns them', () => {
  const OSU = '0101000020E6100000560E2DB29DEFC7BF7C613255306A1640'; // POINT(-0.187 5.6037)
  const KUMASI = '0101000020E61000005AF5B9DA8AFDF9BF1B2FDD2406C11A40'; // POINT(-1.6244 6.6885)
  const rows = {
    pickup_requests: [{ id: 'p1', status: 'accepted', coordinates: OSU, accepted_at: '2026-11-13T08:00:00Z' }],
    digital_bins: [{ id: 'b1', status: 'accepted', accepted_at: '2026-11-13T09:00:00Z', bin_locations: { location_name: 'Home', coordinates: KUMASI } }],
  };
  beforeEach(() => {
    supabase.from.mockImplementation((table) => {
      const builder = new Proxy({}, {
        get: (_, method) => {
          if (method === 'then') return (resolve) => resolve({ data: rows[table] || [], error: null });
          return () => builder;
        },
      });
      return builder;
    });
  });

  it('a pickup and a digital bin stored as PostGIS points both reach the route, in the right place', async () => {
    const result = await new AnalyticsService(COLLECTOR).getCurrentRouteData();
    const byId = Object.fromEntries(result.data.assignments.map((a) => [a.id, a]));
    expect(byId.p1).toMatchObject({ latitude: expect.closeTo(5.6037, 4), longitude: expect.closeTo(-0.187, 4) });
    expect(byId.b1).toMatchObject({ latitude: expect.closeTo(6.6885, 4), longitude: expect.closeTo(-1.6244, 4) });
  });

  it('an unreadable position is still left off rather than placed at sea', async () => {
    rows.pickup_requests = [{ id: 'p2', status: 'accepted', coordinates: 'not a point' }];
    rows.digital_bins = [];
    const result = await new AnalyticsService(COLLECTOR).getCurrentRouteData();
    expect(result.data.assignments).toEqual([]);
  });
});
