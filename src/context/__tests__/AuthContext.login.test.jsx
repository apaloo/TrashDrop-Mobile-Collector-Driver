import { render, screen, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import { authService } from '../../services/supabase';
import { statusService } from '../../services/statusService';
import { PROFILE_STATE } from '../../utils/collectorProfile';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));
jest.mock('../../services/statusService', () => ({
  statusService: { setOnlineEligibility: jest.fn(), forceOffline: jest.fn(), setServerDuty: jest.fn(() => Promise.resolve({ ok: true })) }
}));
jest.mock('../../services/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      getSession: jest.fn(() => Promise.resolve({ data: { session: null } })),
      signOut: jest.fn()
    }
  },
  authService: {
    getSession: jest.fn(() => Promise.resolve({ session: null, user: null })),
    isRegisteredCollectorPhone: jest.fn(),
    sendOtp: jest.fn(),
    verifyOtp: jest.fn(),
    getUserProfile: jest.fn(),
    signOut: jest.fn(() => Promise.resolve({ success: true }))
  }
}));

const JACK = {
  user_id: 'jack', first_name: 'Jack', last_name: 'Bhone', phone: '+233245724489', region: 'Greater Accra',
  vehicle_type: 'cart', license_plate: 'GR-9234-24', status: 'active', deactivated_at: null
};

let auth;
const Probe = () => {
  auth = useAuth();
  return <div data-testid="state">{auth.isAuthenticated ? 'in' : 'out'}:{auth.profileState}</div>;
};

const renderProvider = async () => {
  render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(authService.getSession).toHaveBeenCalled());
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

describe('sendLoginOtp', () => {
  it('does not send a code to a number without a collector profile', async () => {
    authService.isRegisteredCollectorPhone.mockResolvedValue({ success: true, registered: false });
    await renderProvider();

    let result;
    await act(async () => { result = await auth.sendLoginOtp('+233209338885'); });

    expect(result).toMatchObject({ success: false, noAccount: true });
    expect(authService.sendOtp).not.toHaveBeenCalled();
  });

  it('sends the code to a registered collector without allowing account creation', async () => {
    authService.isRegisteredCollectorPhone.mockResolvedValue({ success: true, registered: true });
    authService.sendOtp.mockResolvedValue({ success: true });
    await renderProvider();

    await act(async () => { await auth.sendLoginOtp('+233245724489'); });

    expect(authService.sendOtp).toHaveBeenCalledWith('+233245724489', { allowCreate: false });
  });

  it('reports no account when Supabase refuses to create the user', async () => {
    authService.isRegisteredCollectorPhone.mockResolvedValue({ success: false, error: 'offline' });
    authService.sendOtp.mockResolvedValue({ success: false, error: 'Signups not allowed for otp' });
    await renderProvider();

    let result;
    await act(async () => { result = await auth.sendLoginOtp('+233209338885'); });

    expect(result).toMatchObject({ success: false, noAccount: true });
  });
});

describe('login', () => {
  it('signs out and keeps no session when the code is right but there is no profile', async () => {
    authService.verifyOtp.mockResolvedValue({ success: true, user: { id: 'orphan', phone: '233209338885' } });
    authService.getUserProfile.mockResolvedValue({ success: false, profile: null, notFound: true });
    await renderProvider();

    let result;
    await act(async () => { result = await auth.login('+233209338885', '123456'); });

    expect(result).toMatchObject({ success: false, noAccount: true });
    expect(authService.signOut).toHaveBeenCalled();
    expect(screen.getByTestId('state')).toHaveTextContent(/^out:/);
    expect(localStorage.getItem('last_login_time')).toBeNull();
  });

  it('signs a registered collector in, Off-Duty, with the profile shared', async () => {
    authService.verifyOtp.mockResolvedValue({ success: true, user: { id: 'jack', phone: '233245724489' } });
    authService.getUserProfile.mockResolvedValue({ success: true, profile: JACK });
    await renderProvider();

    await act(async () => { await auth.login('+233245724489', '123456'); });

    expect(screen.getByTestId('state')).toHaveTextContent(`in:${PROFILE_STATE.READY}`);
    expect(auth.profile.first_name).toBe('Jack');
    expect(authService.signOut).not.toHaveBeenCalled();
    expect(statusService.forceOffline).toHaveBeenCalled();
    expect(statusService.setServerDuty).toHaveBeenCalledWith(false);
    expect(statusService.setOnlineEligibility).toHaveBeenLastCalledWith(true);
    // Loaded once during login, not again by the effect
    expect(authService.getUserProfile).toHaveBeenCalledTimes(1);
  });
});
