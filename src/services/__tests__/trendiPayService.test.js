// TrendiPay gateway client (collections from clients). Calls go through the
// trendipay-proxy Edge Function, which holds the API key and lets only
// signed-in collectors through. These tests pin what the app sends, how it
// reads the gateway's answer, and that phone numbers never reach the console
// in full.

jest.mock('../../utils/logger', () => ({ logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } }));
jest.mock('../supabase', () => ({
  supabase: { auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 'user-token' } } }) } },
}));

const MOMO = '0244123456';
let requests = [];
let mockResponse = () => ({ status: 200, body: { success: true, data: { success: true, data: { rrn: 'rrn-1', status: 'pending', reason: 'Approve on your phone', accountNumber: MOMO } } } });

const load = () => {
  process.env.VITE_SUPABASE_URL = 'https://proj.supabase.co';
  process.env.VITE_SUPABASE_ANON_KEY = 'anon-key';
  process.env.VITE_TRENDIPAY_TERMINAL_ID = 'T1';
  let mod;
  jest.isolateModules(() => { mod = require('../trendiPayService'); });
  return mod;
};

let logged = '';
beforeEach(() => {
  requests = [];
  logged = '';
  mockResponse = () => ({ status: 200, body: { success: true, data: { success: true, data: { rrn: 'rrn-1', status: 'pending', reason: 'Approve on your phone', accountNumber: MOMO } } } });
  global.fetch = async (url, options) => {
    requests.push({ url, options, body: JSON.parse(options.body) });
    const r = mockResponse();
    return { ok: r.status < 400, status: r.status, statusText: '', text: async () => JSON.stringify(r.body) };
  };
  const capture = (...args) => { logged += args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ') + '\n'; };
  jest.spyOn(console, 'log').mockImplementation(capture);
  jest.spyOn(console, 'warn').mockImplementation(capture);
  jest.spyOn(console, 'error').mockImplementation(capture);
});
afterEach(() => jest.restoreAllMocks());

const COLLECT = { reference: 'pay-1', accountNumber: MOMO, rSwitch: 'MTN', amount: 26.5, description: 'Digital bin' };

describe('redactForLog', () => {
  it('masks phone numbers at any depth and leaves everything else', () => {
    const { redactForLog } = load();
    expect(redactForLog({ amount: 10, accountNumber: MOMO, data: { data: { msisdn: '233244123456', status: 'ok' } }, list: [{ phone: '0201234567' }] }))
      .toEqual({ amount: 10, accountNumber: '024***56', data: { data: { msisdn: '233***56', status: 'ok' } }, list: [{ phone: '020***67' }] });
  });
});

describe('initiateCollection', () => {
  it('sends the bill in pesewas, network in lower case, through the proxy with the user token', async () => {
    const { initiateCollection } = load();
    const res = await initiateCollection(COLLECT);
    expect(requests).toHaveLength(1);
    const [req] = requests;
    expect(req.url).toBe('https://proj.supabase.co/functions/v1/trendipay-proxy');
    expect(req.options.headers.Authorization).toBe('Bearer user-token');
    expect(req.options.headers.apikey).toBe('anon-key');
    expect(req.body).toMatchObject({ action: 'initiate-collection', terminalId: 'T1' });
    expect(req.body.payload).toMatchObject({
      reference: 'pay-1', accountNumber: MOMO, rSwitch: 'mtn', amount: 2650, type: 'purchase', currency: 'GHS',
      callbackUrl: 'https://proj.supabase.co/functions/v1/trendipay-webhook',
    });
    expect(res).toMatchObject({ success: true, transactionId: 'rrn-1', status: 'pending', message: 'Approve on your phone' });
  });

  it('never writes the full MoMo number to the console', async () => {
    const { initiateCollection } = load();
    await initiateCollection(COLLECT);
    expect(logged).not.toContain(MOMO);
    expect(logged).toContain('024***56');
  });

  it.each([
    ['no reference', { ...COLLECT, reference: '' }, 'Missing required collection parameters: reference'],
    ['less than GH₵1', { ...COLLECT, amount: 0.5 }, 'Amount must be at least 1.00 GHS (100 pesewas)'],
  ])('%s: refused without calling the gateway', async (_l, params, message) => {
    const { initiateCollection } = load();
    expect(await initiateCollection(params)).toEqual({ success: false, error: message });
    expect(requests).toEqual([]);
  });

  it("reports the gateway's refusal", async () => {
    mockResponse = () => ({ status: 403, body: { error: 'Only active collectors can do this' } });
    const { initiateCollection } = load();
    expect(await initiateCollection(COLLECT)).toEqual({ success: false, error: 'Only active collectors can do this' });
  });
});
