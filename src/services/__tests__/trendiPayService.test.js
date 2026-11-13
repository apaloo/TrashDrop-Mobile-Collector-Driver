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

// Added 2026-11-13 (TD33): status checks confirm a client's MoMo payment
// (paymentService), and disbursements pay collectors (Earnings cash-out).
describe('checkCollectionStatus', () => {
  it('asks the proxy about the transaction and reads the gateway answer inside its envelope', async () => {
    mockResponse = () => ({ status: 200, body: { success: true, data: { success: true, data: { status: 'success', reason: 'Approved', amount: 2650, lastUpdated: '2026-11-13T09:00:00Z', accountNumber: MOMO } } } });
    const { checkCollectionStatus } = load();
    const res = await checkCollectionStatus('rrn-1', 'pay-1');
    expect(requests[0].body).toMatchObject({ action: 'check-transaction-status', transactionId: 'rrn-1', payload: null });
    expect(res).toMatchObject({ success: true, status: 'success', message: 'Approved', amount: 2650, completedAt: '2026-11-13T09:00:00Z', transactionId: 'rrn-1' });
    expect(logged).not.toContain(MOMO);
  });

  it('also reads an answer without the inner envelope', async () => {
    mockResponse = () => ({ status: 200, body: { success: true, data: { status: 'failed', message: 'Insufficient funds' } } });
    const { checkCollectionStatus } = load();
    expect(await checkCollectionStatus('rrn-2')).toMatchObject({ success: true, status: 'failed', message: 'Insufficient funds' });
  });

  it("reports the proxy's refusal instead of a status", async () => {
    mockResponse = () => ({ status: 400, body: { success: false, error: 'Missing or invalid transactionId (rrn)' } });
    const { checkCollectionStatus } = load();
    expect(await checkCollectionStatus('bad id')).toEqual({ success: false, error: 'Missing or invalid transactionId (rrn)' });
  });
});

describe('initiateDisbursement (paying a collector)', () => {
  const PAYOUT = { reference: 'wd-1', accountNumber: MOMO, rSwitch: 'TELECEL', amount: 21.75, accountName: 'Kofi Mensah' };

  it('sends the payout in pesewas as a deposit, with the collector\'s name, through the proxy', async () => {
    mockResponse = () => ({ status: 200, body: { success: true, data: { success: true, data: { rrn: 'rrn-9', status: 'processing', reason: 'Queued' } } } });
    const { initiateDisbursement } = load();
    const res = await initiateDisbursement(PAYOUT);
    const [req] = requests;
    expect(req.body).toMatchObject({ action: 'initiate-disbursement', terminalId: 'T1' });
    expect(req.options.headers.Authorization).toBe('Bearer user-token');
    expect(req.body.payload).toMatchObject({
      reference: 'wd-1', accountNumber: MOMO, amount: 2175, type: 'deposit', currency: 'GHS',
      accountName: 'Kofi Mensah', senderName: 'TrashDrop',
      callbackUrl: 'https://proj.supabase.co/functions/v1/trendipay-webhook',
    });
    expect(req.body.payload.rSwitch).toBe(req.body.payload.rSwitch.toLowerCase());
    expect(res).toMatchObject({ success: true, transactionId: 'rrn-9', rrn: 'rrn-9', status: 'processing', message: 'Queued' });
  });

  it('never writes the full MoMo number to the console', async () => {
    const { initiateDisbursement } = load();
    await initiateDisbursement(PAYOUT);
    expect(logged).not.toContain(MOMO);
  });

  it('without a name, the account number stands in (the gateway requires one)', async () => {
    const { initiateDisbursement } = load();
    await initiateDisbursement({ ...PAYOUT, accountName: '' });
    expect(requests[0].body.payload.accountName).toBe(MOMO);
  });

  it.each([
    ['no MoMo number', { ...PAYOUT, accountNumber: '' }, 'Missing required disbursement parameters: accountNumber'],
    ['no amount', { ...PAYOUT, amount: 0 }, 'Missing required disbursement parameters: amount'],
    ['a negative amount', { ...PAYOUT, amount: -5 }, 'Amount must be greater than zero'],
    ['less than GH₵1', { ...PAYOUT, amount: 0.99 }, 'Amount must be at least 1.00 GHS (100 pesewas)'],
  ])('%s: refused without calling the gateway', async (_l, params, message) => {
    const { initiateDisbursement } = load();
    expect(await initiateDisbursement(params)).toEqual({ success: false, error: message });
    expect(requests).toEqual([]);
  });

  it("reports the proxy's refusal (only active collectors may cash out)", async () => {
    mockResponse = () => ({ status: 403, body: { error: 'Only active collectors can do this' } });
    const { initiateDisbursement } = load();
    expect(await initiateDisbursement(PAYOUT)).toEqual({ success: false, error: 'Only active collectors can do this' });
  });
});

describe('talking to the proxy', () => {
  it('a reply that is not JSON is an error, not a payment', async () => {
    global.fetch = async (url, options) => {
      requests.push({ url, options, body: JSON.parse(options.body) });
      return { ok: false, status: 502, statusText: 'Bad Gateway', text: async () => '<html>502</html>' };
    };
    const { initiateCollection } = load();
    const res = await initiateCollection(COLLECT);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Invalid JSON response \(status 502\)/);
  });

  it('retries a dropped connection, then succeeds', async () => {
    let attempts = 0;
    global.fetch = async (url, options) => {
      attempts++;
      requests.push({ url, options, body: JSON.parse(options.body) });
      if (attempts === 1) throw new TypeError('Failed to fetch');
      return { ok: true, status: 200, statusText: '', text: async () => JSON.stringify({ success: true, data: { success: true, data: { rrn: 'rrn-1', status: 'pending' } } }) };
    };
    const { initiateCollection } = load();
    const res = await initiateCollection(COLLECT);
    expect(attempts).toBe(2);
    expect(res).toMatchObject({ success: true, transactionId: 'rrn-1' });
  }, 10000);

  it('a refused request is not retried', async () => {
    mockResponse = () => ({ status: 403, body: { error: 'Sign in to check a payment' } });
    const { checkCollectionStatus } = load();
    await checkCollectionStatus('rrn-1');
    expect(requests).toHaveLength(1);
  });

  it('there is no way to check a payout from the app (that status comes from the server\'s webhook)', () => {
    const mod = load();
    expect(mod.checkDisbursementStatus).toBeUndefined();
    expect(mod.default.checkDisbursementStatus).toBeUndefined();
  });
});
