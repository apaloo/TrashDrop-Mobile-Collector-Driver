import { statusService, COLLECTOR_STATUS } from '../statusService';
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

beforeEach(() => {
  jest.clearAllMocks();
  profileUpdate.error = null;
  // collector_profiles gets the duty update; other tables (sessions) just succeed
  supabase.from.mockImplementation((table) => (table === 'collector_profiles'
    ? { update }
    : { upsert: () => Promise.resolve({ error: null }), insert: () => Promise.resolve({ error: null }), select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: { code: 'PGRST116' } }) }) }) }));
  statusService.setOnlineEligibility(false);
});

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

describe('duty status on the server', () => {
  it('going On-Duty and Off-Duty writes collector_profiles.on_duty', async () => {
    statusService.setOnlineEligibility(true);
    update.mockClear();
    await statusService.setStatus(COLLECTOR_STATUS.ONLINE);
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ on_duty: true }));
    expect(eq).toHaveBeenLastCalledWith('user_id', 'jack');

    await statusService.setStatus(COLLECTOR_STATUS.OFFLINE);
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ on_duty: false }));
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

  it('when the profile loads Off-Duty, clears any On-Duty left on the server', () => {
    update.mockClear();
    statusService.setOnlineEligibility(true);
    return Promise.resolve().then(() => new Promise(r => setTimeout(r, 0))).then(() => {
      expect(update).toHaveBeenCalledWith(expect.objectContaining({ on_duty: false }));
    });
  });
});
