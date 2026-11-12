// Releasing expired assignments (runs every minute from each open collector
// app). The database's status flow (enforce_pickup_status_flow) lets an
// accepted request go back to pending, but refuses en_route/arrived ->
// pending. So only accepted requests may be released; asking for the others
// made the whole batch update fail, which also kept expired accepted
// requests out of the pool.
import { RequestManagementService } from '../requestManagement';
import { supabase } from '../supabase';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../supabase', () => ({ supabase: { from: jest.fn(), channel: jest.fn(), removeChannel: jest.fn() } }));

// Records every query as [method, ...args] and answers selects with `rows`
let selects;
let updates;
function database(rows, { updateError = null } = {}) {
  selects = [];
  updates = [];
  supabase.from.mockImplementation(() => {
    const own = [];
    const builder = new Proxy({}, {
      get: (_, method) => {
        if (method === 'then') {
          const isUpdate = own.some((c) => c[0] === 'update');
          (isUpdate ? updates : selects).push(own);
          const result = isUpdate ? { data: null, error: updateError } : { data: rows, error: null };
          return (resolve, reject) => Promise.resolve(result).then(resolve, reject);
        }
        return (...args) => { own.push([method, ...args]); return builder; };
      },
    });
    return builder;
  });
}
const find = (query, method) => query.filter((c) => c[0] === method);

const service = () => new RequestManagementService();

describe('cleanupExpiredAssignments', () => {
  it('looks only for accepted requests (the one status the database lets go back to pending)', async () => {
    database([]);
    await service().cleanupExpiredAssignments();
    const [select] = selects;
    expect(find(select, 'eq')).toEqual([['eq', 'status', 'accepted']]);
    expect(find(select, 'in')).toEqual([]); // no en_route or arrived
    expect(find(select, 'lt')[0].slice(0, 2)).toEqual(['lt', 'assignment_expires_at']);
  });

  it('releases the expired accepted requests back to the pool', async () => {
    database([{ id: 'a' }, { id: 'b' }]);
    const res = await service().cleanupExpiredAssignments();
    expect(res).toEqual({ success: true, cleaned: 2 });
    const [update] = updates;
    expect(find(update, 'update')[0][1]).toEqual({ status: 'pending', collector_id: null, accepted_at: null, assignment_expires_at: null });
    expect(find(update, 'in')).toEqual([['in', 'id', ['a', 'b']]]);
    // a request that moved on (en route) between the select and the update is left alone
    expect(find(update, 'eq')).toEqual([['eq', 'status', 'accepted']]);
  });

  it('does nothing when no assignment has expired', async () => {
    database([]);
    expect(await service().cleanupExpiredAssignments()).toEqual({ success: true, cleaned: 0 });
    expect(updates).toEqual([]);
  });

  it('still reports a database refusal', async () => {
    database([{ id: 'a' }], { updateError: { message: 'Status cannot change from arrived to pending' } });
    await expect(service().cleanupExpiredAssignments()).rejects.toMatchObject({ message: expect.stringMatching(/cannot change/) });
  });
});
