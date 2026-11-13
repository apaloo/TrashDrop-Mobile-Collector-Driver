// Disposing a pickup request (protected payout code: tests only add cases).
// Pickup requests are prepaid bags: the database works out the collector's
// payout, 100% of the scanned bags' unit prices plus confirmed tips, and
// stores it (finalize_pickup_request_payout; docs/COLLECTOR_PAYOUTS.md in the
// household repository). The app only checks the request, asks for that
// payout, and marks the request disposed, sending no payout figures.
import { disposePickupRequest } from '../disposalService';
import { supabase } from '../supabase';

jest.mock('../../utils/logger', () => ({ logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('../supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));

const COLLECTOR = 'c-1';
const REQUEST = { id: 'r-1', status: 'collecting', collector_id: COLLECTOR, user_id: 'u-1', fee: 2.5 };

let request; let updates; let updateError; let rpcAnswer; let calls;
beforeEach(() => {
  jest.clearAllMocks();
  request = { ...REQUEST }; updates = []; updateError = null; calls = [];
  rpcAnswer = { data: { model: 'prepaid_bags', bags_scanned: 4, bag_total: 10, tips: 2, total: 12 }, error: null };
  supabase.rpc.mockImplementation((fn, args) => { calls.push(['rpc', fn, args]); return Promise.resolve(rpcAnswer); });
  supabase.from.mockImplementation((table) => {
    const own = [];
    const finish = () => {
      if (table === 'pickup_requests' && own.some((c) => c[0] === 'update')) return { error: updateError };
      if (table === 'pickup_requests') return request ? { data: request, error: null } : { data: null, error: { message: 'no rows' } };
      return { data: null, error: null }; // notifications
    };
    const builder = new Proxy({}, {
      get: (_, method) => {
        if (method === 'then') return (resolve, reject) => Promise.resolve(finish()).then(resolve, reject);
        return (...args) => {
          own.push([method, ...args]);
          calls.push([table, method, ...args]);
          if (table === 'pickup_requests' && method === 'update') updates.push(args[0]);
          return method === 'single' || method === 'maybeSingle' ? Promise.resolve(finish()) : builder;
        };
      },
    });
    return builder;
  });
});

describe('disposePickupRequest', () => {
  it('asks the database for the payout and shows what it stored: all of it the collector\'s', async () => {
    const r = await disposePickupRequest('r-1', COLLECTOR, { name: 'Kpone Landfill', address: 'Tema' });
    expect(r.success).toBe(true);
    expect(calls).toContainEqual(['rpc', 'finalize_pickup_request_payout', { p_request_id: 'r-1' }]);
    expect(r.payoutBreakdown).toMatchObject({ collector_core_payout: 10, collector_tips: 2, collector_total_payout: 12, platform_share: 0, bags_scanned: 4 });
  });

  it('marks it disposed at the site, with no payout figures sent, only for this collector', async () => {
    await disposePickupRequest('r-1', COLLECTOR, { name: 'Kpone Landfill', address: 'Tema' });
    expect(updates).toHaveLength(1);
    const u = updates[0];
    expect(u).toMatchObject({ status: 'disposed', disposal_site: 'Kpone Landfill, Tema' });
    expect(u.disposed_at).toBe(u.disposal_timestamp);
    expect(Object.keys(u).filter((k) => /payout|share|tips|fee|amount/.test(k))).toEqual([]);
    expect(calls).toContainEqual(['pickup_requests', 'eq', 'collector_id', COLLECTOR]);
  });

  it('a site without a name is "Disposal Center"; a name without an address is just the name', async () => {
    await disposePickupRequest('r-1', COLLECTOR);
    expect(updates[0].disposal_site).toBe('Disposal Center');
    await disposePickupRequest('r-1', COLLECTOR, { name: 'Abokobi site' });
    expect(updates[1].disposal_site).toBe('Abokobi site');
  });

  it('a request already picked up can be disposed too', async () => {
    request.status = 'picked_up';
    expect((await disposePickupRequest('r-1', COLLECTOR)).success).toBe(true);
  });

  it.each([['pending'], ['accepted'], ['en_route'], ['arrived'], ['disposed'], ['cancelled']])('refuses a request that is %s, before any payout', async (status) => {
    request.status = status;
    const r = await disposePickupRequest('r-1', COLLECTOR);
    expect(r).toEqual({ success: false, error: `Request must be in 'collecting' or 'picked_up' status. Current: ${status}` });
    expect(calls.some((c) => c[0] === 'rpc')).toBe(false);
    expect(updates).toEqual([]);
  });

  it('refuses another collector\'s request, before any payout', async () => {
    const r = await disposePickupRequest('r-1', 'someone-else');
    expect(r).toEqual({ success: false, error: 'This request is assigned to a different collector' });
    expect(calls.some((c) => c[0] === 'rpc')).toBe(false);
    expect(updates).toEqual([]);
  });

  it('a request that cannot be read is not disposed', async () => {
    request = null;
    const r = await disposePickupRequest('r-x', COLLECTOR);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/Pickup request not found/);
    expect(updates).toEqual([]);
  });

  it('when the database refuses the payout, the request is not marked disposed', async () => {
    rpcAnswer = { data: null, error: { message: 'No bags scanned for this request' } };
    const r = await disposePickupRequest('r-1', COLLECTOR);
    expect(r).toEqual({ success: false, error: 'No bags scanned for this request' });
    expect(updates).toEqual([]);
  });

  it('a refused update is a failure, never reported as disposed', async () => {
    updateError = { message: 'new row violates row-level security policy' };
    const r = await disposePickupRequest('r-1', COLLECTOR);
    expect(r).toEqual({ success: false, error: 'Failed to update request: new row violates row-level security policy' });
  });

  it('an answer without figures shows 0, never a made-up payout', async () => {
    rpcAnswer = { data: null, error: null };
    const r = await disposePickupRequest('r-1', COLLECTOR);
    expect(r.payoutBreakdown).toMatchObject({ collector_core_payout: 0, collector_tips: 0, collector_total_payout: 0, platform_share: 0 });
  });
});
