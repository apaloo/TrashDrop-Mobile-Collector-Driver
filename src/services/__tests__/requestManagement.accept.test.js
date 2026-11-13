// Accepting a pickup request (critical workflow): the checks the app makes
// before it writes, what it writes, and the messages a collector sees.
//
// The database is the final guard against two collectors taking the same
// request (row-level security only lets an active collector update a
// request that is still pending with no collector, and the status-flow
// triggers refuse accepted -> accepted). These tests cover the app's side.
import { RequestManagementService } from '../requestManagement';
import { supabase } from '../supabase';
import { getCurrentLocation } from '../../utils/geoUtils';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../utils/geoUtils', () => ({
  calculateDistance: jest.fn(() => 1),
  getCurrentLocation: jest.fn(async () => null), // no GPS: the legacy fee path
}));
jest.mock('../supabase', () => ({ supabase: { from: jest.fn(), channel: jest.fn(), removeChannel: jest.fn() } }));

const COLLECTOR = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const HOUSEHOLD = '33333333-3333-4333-8333-333333333333';
const REQUEST = '44444444-4444-4444-8444-444444444444';

// A fake query builder. Every call is recorded as [table, method, ...args];
// `answer(table, calls)` decides what the finished query returns.
let calls;
function fakeSupabase(answer) {
  calls = [];
  supabase.from.mockImplementation((table) => {
    const own = [];
    const finish = () => answer(table, own);
    const builder = new Proxy({}, {
      get: (_, method) => {
        if (method === 'then') return (resolve, reject) => Promise.resolve(finish()).then(resolve, reject);
        return (...args) => {
          own.push([method, ...args]);
          calls.push([table, method, ...args]);
          return method === 'single' ? Promise.resolve(finish()) : builder;
        };
      },
    });
    return builder;
  });
}
const did = (table, method) => calls.filter((c) => c[0] === table && c[1] === method);
const isUpdate = (own) => own.some((c) => c[0] === 'update');
const isInsert = (own) => own.some((c) => c[0] === 'insert');

const pending = { id: REQUEST, status: 'pending', collector_id: null, user_id: HOUSEHOLD, waste_type: 'general', fee: 25 };

function service({ initialized = true, collectorId = COLLECTOR } = {}) {
  const s = new RequestManagementService();
  s.isInitialized = initialized;
  s.collectorId = collectorId;
  return s;
}

// The usual database: the request as given, the update succeeds, no session,
// a named collector, and the notification insert succeeds
function database(request, { updateRows, updateError = null } = {}) {
  fakeSupabase((table, own) => {
    if (table === 'pickup_requests' && isUpdate(own)) {
      return { data: updateRows ?? [{ ...request, status: 'accepted', collector_id: COLLECTOR }], error: updateError };
    }
    if (table === 'pickup_requests') {
      return request ? { data: request, error: null } : { data: null, error: { code: 'PGRST116', message: 'no rows' } };
    }
    if (table === 'collector_sessions') return { data: null, error: null };
    if (table === 'collector_profiles') return { data: { first_name: 'Kofi', last_name: 'Mensah' }, error: null };
    if (table === 'notifications' && isInsert(own)) return { data: null, error: null };
    return { data: null, error: null };
  });
}

beforeEach(() => jest.clearAllMocks());

describe('acceptRequest: refused before anything is written', () => {
  it.each([
    ['the service is not ready', { initialized: false }, REQUEST, /not initialized/],
    ['the request is still a local draft', {}, 'temp-123', /temporary requests/],
    ['the id is not a request id', {}, 'not-a-uuid', /Invalid request ID/],
    ['nobody is signed in', { collectorId: null }, REQUEST, /Authentication required/],
  ])('%s', async (_, opts, requestId, message) => {
    database(pending);
    const result = await service(opts).acceptRequest(requestId);
    expect(result).toEqual({ success: false, error: expect.stringMatching(message) });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('the request no longer exists', async () => {
    database(null);
    const result = await service().acceptRequest(REQUEST);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
    expect(did('pickup_requests', 'update')).toHaveLength(0);
  });

  it.each(['accepted', 'completed', 'cancelled'])('the request is already %s', async (status) => {
    database({ ...pending, status, collector_id: OTHER });
    const result = await service().acceptRequest(REQUEST);
    expect(result).toEqual({ success: false, error: `Request is no longer available - current status: ${status}` });
    expect(did('pickup_requests', 'update')).toHaveLength(0);
  });

  it('another collector already holds it', async () => {
    database({ ...pending, collector_id: OTHER });
    const result = await service().acceptRequest(REQUEST);
    expect(result).toEqual({ success: false, error: 'Request has already been accepted by another collector' });
    expect(did('pickup_requests', 'update')).toHaveLength(0);
  });
});

describe('acceptRequest: accepting', () => {
  it('assigns the request to this collector for 10 hours and tells the household', async () => {
    const before = Date.now();
    database(pending);
    const result = await service().acceptRequest(REQUEST);

    expect(result.success).toBe(true);
    expect(result.request).toMatchObject({ id: REQUEST, status: 'accepted', collector_id: COLLECTOR });

    const [[, , written]] = did('pickup_requests', 'update');
    expect(written).toMatchObject({ status: 'accepted', collector_id: COLLECTOR });
    const expiresIn = Date.parse(written.assignment_expires_at) - before;
    expect(expiresIn).toBeGreaterThanOrEqual(10 * 60 * 60 * 1000 - 1000);
    expect(expiresIn).toBeLessThanOrEqual(10 * 60 * 60 * 1000 + 5000);

    const [[, , notification]] = did('notifications', 'insert');
    expect(notification).toMatchObject({ user_id: HOUSEHOLD, type: 'pickup_accepted', read: false });
    expect(notification.message).toMatch(/^Kofi Mensah has accepted your general pickup request/);
  });

  // TD34 (owner's decision 2026-11-13): a pickup is paid 100% of its bag
  // prices by the database at disposal, so accepting works out no payout
  it('works out no payout and asks for no location: only status, collector and times are written', async () => {
    database(pending);
    const result = await service().acceptRequest(REQUEST);
    expect(result.success).toBe(true);
    expect(getCurrentLocation).not.toHaveBeenCalled();
    const [[, , written]] = did('pickup_requests', 'update');
    expect(Object.keys(written).sort()).toEqual(['accepted_at', 'assignment_expires_at', 'collector_id', 'status']);
  });

  it('still succeeds when the household notification cannot be written', async () => {
    database(pending);
    const okAnswer = supabase.from.getMockImplementation();
    supabase.from.mockImplementation((table) => {
      if (table === 'notifications') throw new Error('notifications unavailable');
      return okAnswer(table);
    });
    const result = await service().acceptRequest(REQUEST);
    expect(result.success).toBe(true);
  });

  it('reports who has it when the update changes nothing (lost a race)', async () => {
    let reads = 0;
    fakeSupabase((table, own) => {
      if (table === 'pickup_requests' && isUpdate(own)) return { data: [], error: null };
      if (table === 'pickup_requests') {
        reads += 1;
        // first read: still pending; after the failed update: taken
        return { data: reads === 1 ? pending : { id: REQUEST, status: 'accepted', collector_id: OTHER }, error: null };
      }
      return { data: null, error: null };
    });
    const result = await service().acceptRequest(REQUEST);
    expect(result).toEqual({ success: false, error: `Request could not be accepted - current status: accepted, collector: ${OTHER}` });
    expect(did('notifications', 'insert')).toHaveLength(0);
  });

  it('explains a database refusal in plain words', async () => {
    database(pending, { updateError: { message: 'new row violates row-level security policy for table "pickup_requests"' } });
    const result = await service().acceptRequest(REQUEST);
    expect(result).toEqual({ success: false, error: 'Access denied - authentication issue' });
  });
});
