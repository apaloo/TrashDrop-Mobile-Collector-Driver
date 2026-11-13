// The collector's sign-in and profile service (src/services/supabase.js).
// Security: logging in never creates an account (only sign-up may), and phone
// numbers reach Supabase in E.164 form. Errors come back as results, never
// thrown, so the screens can show them.
import { authService, formatPhoneNumber } from '../supabase';

const mockCalls = [];
let mockAnswers = {};
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => {
    const answer = (key, fallback) => Promise.resolve(mockAnswers[key] || fallback);
    const table = (name) => {
      const q = {
        select: () => q,
        eq: () => q,
        insert: (rows) => { mockCalls.push(['insert', name, rows]); return q; },
        update: (row) => { mockCalls.push(['update', name, row]); return q; },
        single: () => answer(`${name}.single`, { data: null, error: null }),
        maybeSingle: () => answer(`${name}.maybeSingle`, { data: null, error: null }),
        then: (resolve) => resolve(mockAnswers[`${name}.write`] || { data: [{ id: 'p1' }], error: null }),
      };
      return q;
    };
    return {
      auth: {
        signInWithOtp: (args) => { mockCalls.push(['signInWithOtp', args]); return answer('otp', { data: {}, error: null }); },
        verifyOtp: (args) => { mockCalls.push(['verifyOtp', args]); return answer('verify', { data: { session: { id: 's' }, user: { id: 'u' } }, error: null }); },
        getSession: () => answer('session', { data: { session: { user: { id: 'u' } } }, error: null }),
        signOut: () => answer('signOut', { error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      },
      rpc: (fn, args) => { mockCalls.push(['rpc', fn, args]); return answer(`rpc.${fn}`, { data: false, error: null }); },
      from: (name) => table(name),
      storage: { from: () => ({}) },
      channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    };
  },
}));
jest.mock('../../utils/logger', () => ({ logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

beforeEach(() => { mockCalls.length = 0; mockAnswers = {}; });

describe('formatPhoneNumber (E.164)', () => {
  it.each([
    ['0241234567', '+233241234567'],
    ['024 123 4567', '+233241234567'],
    ['241234567', '+233241234567'],
    ['+233241234567', '+233241234567'],
    ['+233 24 123 4567', '+233241234567'],
    ['+233-24-123-4567', '+233241234567'],
    [' +233 24 123 4567', '+233241234567'],
  ])('%s -> %s', (typed, e164) => {
    expect(formatPhoneNumber(typed)).toBe(e164);
  });
});

describe('sign-in', () => {
  it('logging in never creates an account', async () => {
    await authService.sendOtp('0241234567');
    expect(mockCalls[0]).toEqual(['signInWithOtp', expect.objectContaining({ phone: '+233241234567', options: expect.objectContaining({ shouldCreateUser: false, channel: 'sms' }) })]);
  });

  it('only sign-up may create one', async () => {
    await authService.sendOtp('0241234567', { allowCreate: true });
    expect(mockCalls[0][1].options.shouldCreateUser).toBe(true);
  });

  it('a refused code request is reported, not thrown', async () => {
    mockAnswers.otp = { data: null, error: { message: 'Signups not allowed for otp' } };
    expect(await authService.sendOtp('0241234567')).toEqual({ success: false, error: 'Signups not allowed for otp' });
  });

  it('verifies the code for the same E.164 number and returns the session', async () => {
    expect(await authService.verifyOtp('024 123 4567', '123456')).toEqual({ success: true, session: { id: 's' }, user: { id: 'u' } });
    expect(mockCalls[0]).toEqual(['verifyOtp', { phone: '+233241234567', token: '123456', type: 'sms' }]);
    mockAnswers.verify = { data: null, error: { message: 'Token has expired or is invalid' } };
    expect(await authService.verifyOtp('0241234567', '000000')).toEqual({ success: false, error: 'Token has expired or is invalid' });
  });

  it('asks whether a number belongs to a collector before texting a code', async () => {
    mockAnswers['rpc.collector_phone_registered'] = { data: true, error: null };
    expect(await authService.isRegisteredCollectorPhone('0241234567')).toEqual({ success: true, registered: true });
    expect(mockCalls[0]).toEqual(['rpc', 'collector_phone_registered', { p_phone: '+233241234567' }]);
    mockAnswers['rpc.collector_phone_registered'] = { data: null, error: { message: 'network' } };
    expect(await authService.isRegisteredCollectorPhone('0241234567')).toEqual({ success: false, error: 'network' });
  });

  it('session and sign-out failures come back as results', async () => {
    expect(await authService.getSession()).toEqual({ session: { user: { id: 'u' } }, user: { id: 'u' } });
    mockAnswers.session = { data: { session: null }, error: { message: 'expired' } };
    expect(await authService.getSession()).toEqual({ session: null, user: null, error: 'expired' });
    mockAnswers.signOut = { error: { message: 'offline' } };
    expect(await authService.signOut()).toEqual({ success: false, error: 'offline' });
  });
});

describe('collector profile', () => {
  it('a new collector gets a profile row; an existing one is updated, never duplicated', async () => {
    await authService.createUserProfile('u1', { user_id: 'u1', first_name: 'Ama' });
    expect(mockCalls).toEqual([['insert', 'collector_profiles', [{ user_id: 'u1', first_name: 'Ama' }]]]);
    mockCalls.length = 0;
    mockAnswers['collector_profiles.single'] = { data: { id: 'p1' }, error: null };
    await authService.createUserProfile('u1', { first_name: 'Ama' });
    expect(mockCalls).toEqual([['update', 'collector_profiles', { first_name: 'Ama' }]]);
  });

  it('no profile yet is "not found", not an error', async () => {
    expect(await authService.getUserProfile('u1')).toEqual({ success: false, profile: null, notFound: true, error: 'Profile not found' });
    mockAnswers['collector_profiles.maybeSingle'] = { data: { id: 'p1' }, error: null };
    expect(await authService.getUserProfile('u1')).toEqual({ success: true, profile: { id: 'p1' } });
  });

  it('a refused profile write is reported', async () => {
    mockAnswers['collector_profiles.write'] = { data: null, error: { message: 'violates row-level security policy' } };
    expect(await authService.updateUserProfile('u1', { phone: 'x' })).toEqual({ success: false, error: 'violates row-level security policy' });
  });
});
