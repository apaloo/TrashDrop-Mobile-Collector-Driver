import { statusService, COLLECTOR_STATUS } from '../statusService';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));
jest.mock('../supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn(() => Promise.resolve({ data: { user: null } })) },
    from: jest.fn()
  }
}));

describe('On-Duty gate', () => {
  beforeEach(() => {
    statusService.setOnlineEligibility(false);
  });

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
