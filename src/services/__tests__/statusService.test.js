import { statusService, COLLECTOR_STATUS, HEARTBEAT_INTERVAL_MS } from '../statusService';
import { supabase } from '../supabase';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

const profileUpdate = { error: null };
const eq = jest.fn(() => Promise.resolve(profileUpdate));
const update = jest.fn(() => ({ eq }));
jest.mock('../supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn(() => Promise.resolve({ data: { user: { id: 'jack' } } })) },
    from: jest.fn()
  }
}));

// Every collector_profiles update: on_duty switches and last_active check-ins
const dutyWrites = () => update.mock.calls.map(([row]) => row).filter(row => 'on_duty' in row);
const heartbeats = () => update.mock.calls.map(([row]) => row).filter(row => 'last_active' in row);
const settle = () => new Promise(r => setTimeout(r, 0));

beforeEach(async () => {
  jest.clearAllMocks();
  profileUpdate.error = null;
  // collector_profiles gets the duty update; other tables (sessions) just succeed
  supabase.from.mockImplementation((table) => (table === 'collector_profiles'
    ? { update }
    : { upsert: () => Promise.resolve({ error: null }), insert: () => Promise.resolve({ error: null }), select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: { code: 'PGRST116' } }) }) }) }));
  statusService.setOnlineEligibility(false);
  // Each test is a fresh app launch
  statusService.forceOffline();
  await settle();
  update.mockClear();
});

afterEach(() => statusService.stopHeartbeat());

describe('On-Duty gate', () => {
  it('starts Off-Duty', () => {
    expect(statusService.getStatus().isOnline).toBe(false);
  });

  it('refuses On-Duty without a complete profile', async () => {
    await expect(statusService.setStatus(COLLECTOR_STATUS.ONLINE)).rejects.toThrow('Finish your sign-up');
    expect(statusService.getStatus().isOnline).toBe(false);
  });

  it('allows On-Duty once eligible, and drops to Off-Duty when eligibility is lost', async () => {
    statusService.setOnlineEligibility(true);
    await statusService.setStatus(COLLECTOR_STATUS.ONLINE);
    expect(statusService.getStatus().isOnline).toBe(true);

    statusService.setOnlineEligibility(false);
    expect(statusService.getStatus().isOnline).toBe(false);
    expect(localStorage.getItem('collector_status')).toBeNull();
  });
});

describe('On-Duty by default when the app opens', () => {
  it('goes On-Duty, on the server too, as soon as the profile is complete', async () => {
    statusService.setOnlineEligibility(true);
    await statusService.goOnDutyByDefault();
    expect(statusService.getStatus().isOnline).toBe(true);
    expect(dutyWrites()).toEqual([expect.objectContaining({ on_duty: true })]);
  });

  it('keeps a status the collector picked until the app is opened again', async () => {
    statusService.setOnlineEligibility(true);
    await statusService.goOnDutyByDefault();
    await statusService.setStatus(COLLECTOR_STATUS.OFFLINE);

    // The profile reloads (e.g. after an edit): the choice stands
    statusService.setOnlineEligibility(false);
    statusService.setOnlineEligibility(true);
    await statusService.goOnDutyByDefault();
    await settle();
    expect(statusService.getStatus().isOnline).toBe(false);
    expect(dutyWrites().slice(-1)[0]).toEqual(expect.objectContaining({ on_duty: false }));
  });

  it('keeps Break the collector picked', async () => {
    statusService.setOnlineEligibility(true);
    await statusService.goOnDutyByDefault();
    await statusService.setStatus(COLLECTOR_STATUS.BREAK);
    await statusService.goOnDutyByDefault();
    expect(statusService.getStatus().status).toBe(COLLECTOR_STATUS.BREAK);
  });

  it('lets a status picked while the default On-Duty is saving win', async () => {
    statusService.setOnlineEligibility(true); // the default starts saving
    await statusService.setStatus(COLLECTOR_STATUS.OFFLINE);
    await statusService.goOnDutyByDefault();
    await settle();
    expect(statusService.getStatus().isOnline).toBe(false);
    expect(dutyWrites().slice(-1)[0]).toEqual(expect.objectContaining({ on_duty: false }));
  });

  it('opens On-Duty again after the choice is cleared (new sign-in)', async () => {
    statusService.setOnlineEligibility(true);
    await statusService.goOnDutyByDefault();
    await statusService.setStatus(COLLECTOR_STATUS.OFFLINE);
    statusService.forceOffline();
    await statusService.goOnDutyByDefault();
    expect(statusService.getStatus().isOnline).toBe(true);
  });

  it('stays Off-Duty without a connection, and tries again when it returns', async () => {
    profileUpdate.error = { message: 'network error' };
    statusService.setOnlineEligibility(true);
    await statusService.goOnDutyByDefault();
    expect(statusService.getStatus().isOnline).toBe(false);

    profileUpdate.error = null;
    window.dispatchEvent(new Event('online'));
    await statusService.goOnDutyByDefault();
    expect(statusService.getStatus().isOnline).toBe(true);
  });
});

describe('heartbeat while On-Duty', () => {
  it('checks in now and every minute while On-Duty, and stops when Off-Duty', async () => {
    jest.useFakeTimers();
    try {
      statusService.setOnlineEligibility(true);
      await statusService.goOnDutyByDefault();
      await Promise.resolve();
      expect(heartbeats().length).toBeGreaterThanOrEqual(1);

      const before = heartbeats().length;
      jest.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 3);
      await Promise.resolve(); await Promise.resolve();
      expect(heartbeats().length).toBe(before + 3);

      await statusService.setStatus(COLLECTOR_STATUS.OFFLINE);
      const after = heartbeats().length;
      jest.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 3);
      await Promise.resolve(); await Promise.resolve();
      expect(heartbeats().length).toBe(after);
    } finally {
      jest.useRealTimers();
    }
  });

  it('writes last_active on the collector\'s own profile', async () => {
    await statusService.sendHeartbeat();
    expect(update).toHaveBeenCalledWith({ last_active: expect.any(String) });
    expect(eq).toHaveBeenLastCalledWith('user_id', 'jack');
  });
});

describe('duty status on the server', () => {
  it('going On-Duty and Off-Duty writes collector_profiles.on_duty', async () => {
    statusService.setOnlineEligibility(true);
    await statusService.goOnDutyByDefault();
    await statusService.setStatus(COLLECTOR_STATUS.OFFLINE);
    update.mockClear();
    await statusService.setStatus(COLLECTOR_STATUS.ONLINE);
    expect(dutyWrites().slice(-1)[0]).toEqual(expect.objectContaining({ on_duty: true }));
    expect(eq).toHaveBeenCalledWith('user_id', 'jack');

    await statusService.setStatus(COLLECTOR_STATUS.OFFLINE);
    expect(dutyWrites().slice(-1)[0]).toEqual(expect.objectContaining({ on_duty: false }));
  });

  it('stays Off-Duty if the server could not record On-Duty', async () => {
    statusService.setOnlineEligibility(true);
    profileUpdate.error = { message: 'network error' };
    await expect(statusService.setStatus(COLLECTOR_STATUS.ONLINE)).rejects.toThrow('Could not go On-Duty');
    expect(statusService.getStatus().isOnline).toBe(false);
  });

  it('keeps working before the on_duty column exists', async () => {
    statusService.setOnlineEligibility(true);
    profileUpdate.error = { message: 'column "on_duty" of relation "collector_profiles" does not exist' };
    await statusService.setStatus(COLLECTOR_STATUS.ONLINE);
    expect(statusService.getStatus().isOnline).toBe(true);
  });

  it('when the collector chose Off-Duty, clears any On-Duty left on the server', async () => {
    statusService.setOnlineEligibility(true);
    await statusService.goOnDutyByDefault();
    await statusService.setStatus(COLLECTOR_STATUS.OFFLINE);
    statusService.setOnlineEligibility(false);
    update.mockClear();
    statusService.setOnlineEligibility(true);
    await settle();
    expect(dutyWrites()).toEqual([expect.objectContaining({ on_duty: false })]);
  });
});
