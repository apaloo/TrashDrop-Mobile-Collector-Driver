import { locationBroadcast } from '../locationBroadcast';
import { supabase } from '../supabase';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

jest.mock('../supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() }
}));

const inserted = [];
const updated = [];
let jobRow;

// Tiny query builder: select().eq().single()/maybeSingle(), update().eq(), insert()
const builder = (table) => {
  const query = {
    select: () => query,
    eq: () => query,
    single: () => Promise.resolve({ data: { user_id: 'user-1', first_name: 'Jack', last_name: 'Bhone', waste_type: 'general' }, error: null }),
    maybeSingle: () => Promise.resolve({ data: jobRow, error: null }),
    insert: (row) => { inserted.push({ table, ...row }); return Promise.resolve({ error: null }); },
    update: (row) => { updated.push({ table, ...row }); return query; },
    then: (resolve) => resolve({ error: null })
  };
  return query;
};

beforeEach(() => {
  jest.useFakeTimers();
  inserted.length = 0;
  updated.length = 0;
  jobRow = { status: 'en_route', collector_id: 'collector-1' };
  supabase.from.mockImplementation(builder);
  supabase.rpc.mockResolvedValue({ error: null });
  global.navigator.geolocation = {
    getCurrentPosition: (ok) => ok({ coords: { latitude: 5.6, longitude: -0.18, accuracy: 5 } })
  };
});

afterEach(() => {
  locationBroadcast.stopTracking();
  jest.useRealTimers();
});

const flush = async () => {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
};

describe('locationBroadcast', () => {
  it('sends the location and an en-route notice for the job being navigated to', async () => {
    await locationBroadcast.startTracking('job-1', 'collector-1', 'digital_bin');
    await flush();

    expect(supabase.rpc).toHaveBeenCalledWith('update_collector_location', {
      p_user_id: 'collector-1', p_longitude: -0.18, p_latitude: 5.6
    });
    expect(supabase.from).toHaveBeenCalledWith('digital_bins');
    expect(inserted.map(n => n.type)).toEqual(['collector_enroute']);
  });

  it('keeps current_location in step when it falls back to a direct update', async () => {
    supabase.rpc.mockResolvedValue({ error: { code: '42883', message: 'function does not exist' } });
    await locationBroadcast.startTracking('job-1', 'collector-1');
    await flush();

    const profileUpdate = updated.find(u => u.table === 'collector_profiles');
    expect(profileUpdate.current_location).toBe('SRID=4326;POINT(-0.18 5.6)');
  });

  it('only sends ETA updates that matter', async () => {
    await locationBroadcast.startTracking('job-1', 'collector-1');
    await flush();
    inserted.length = 0;

    await locationBroadcast.updateETA(12); // first ETA
    await locationBroadcast.updateETA(11); // small change: skipped
    await locationBroadcast.updateETA(6); // 6 min sooner: sent

    expect(inserted.filter(n => n.type === 'eta_update').map(n => n.message)).toEqual([
      'Your collector will arrive in approximately 12 minutes.',
      'Your collector will arrive in approximately 6 minutes.'
    ]);
  });

  it('switches to a new job instead of ignoring it', async () => {
    await locationBroadcast.startTracking('job-1', 'collector-1');
    await locationBroadcast.startTracking('job-2', 'collector-1');
    expect(locationBroadcast.currentRequestId).toBe('job-2');
  });

  it('stops once the job is no longer active', async () => {
    await locationBroadcast.startTracking('job-1', 'collector-1');
    await flush();
    jobRow = { status: 'picked_up', collector_id: 'collector-1' };

    for (let i = 0; i < locationBroadcast.STATUS_CHECK_EVERY; i += 1) {
      jest.advanceTimersByTime(locationBroadcast.BROADCAST_INTERVAL);
      await flush();
    }

    expect(locationBroadcast.isTracking).toBe(false);
  });
});
