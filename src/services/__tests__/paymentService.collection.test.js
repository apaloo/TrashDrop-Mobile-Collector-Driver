// Recording a client's payment for a digital bin (collector app, protected
// payout code: these tests only pin what it does today). The database sets
// the shares, caps them at the booked payout and keeps the record pending
// (td_guard_bin_payment, docs/COLLECTOR_PAYOUTS.md in the household
// repository); these tests pin what the app sends and how it reports each
// outcome.

jest.mock('../../utils/logger', () => ({ logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } }));

// Recorded calls: ['insert', table, rows] / ['update', table, values, id] /
// ['gateway', params]. Plain functions: resetMocks would wipe jest.fn.
let mockCalls = [];
let mockInsertResult = () => ({ data: { id: 'pay-1', status: 'pending' }, error: null });
let mockGateway = () => ({ success: true, status: 'pending', transactionId: 't-1', gatewayReference: 'g-1', message: 'Approve on your phone' });

jest.mock('../supabase', () => ({
  supabase: {
    from: (table) => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: { is_urgent: false, deadhead_km: 0, is_promotional: false, bin_size_liters: 240, bag_count: 1, collector_core_payout: 25 }, error: null }) }),
      }),
      insert: (rows) => {
        mockCalls.push(['insert', table, rows]);
        return { select: () => ({ single: () => Promise.resolve(mockInsertResult()) }) };
      },
      update: (values) => ({
        eq: (_col, id) => { mockCalls.push(['update', table, values, id]); return Promise.resolve({ error: null }); },
      }),
    }),
  },
}));
jest.mock('../trendiPayService', () => ({
  initiateCollection: (params) => { mockCalls.push(['gateway', params]); return Promise.resolve(mockGateway(params)); },
}));

const load = (trendipay) => {
  process.env.VITE_ENABLE_TRENDIPAY = trendipay ? 'true' : 'false';
  let mod;
  jest.isolateModules(() => { mod = require('../paymentService'); });
  return mod;
};

const BASE = { digitalBinId: 'bin-12345678', collectorId: 'prof-1', binsCollected: 1, totalBill: 26 };

beforeEach(() => {
  mockCalls = [];
  mockInsertResult = () => ({ data: { id: 'pay-1', status: 'pending' }, error: null });
  mockGateway = () => ({ success: true, status: 'pending', transactionId: 't-1', gatewayReference: 'g-1', message: 'Approve on your phone' });
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('initiateCollection: checks before anything is recorded', () => {
  it.each([
    ['missing bin', { ...BASE, digitalBinId: null, paymentMode: 'cash' }, 'Missing required IDs'],
    ['no amount', { ...BASE, totalBill: 0, paymentMode: 'cash' }, 'Invalid amount'],
    ['unknown mode', { ...BASE, paymentMode: 'card' }, 'Invalid payment mode'],
    ['MoMo without a number', { ...BASE, paymentMode: 'momo' }, 'Client MoMo number required'],
  ])('%s: refused, nothing written', async (_label, data, message) => {
    const { initiateCollection } = load(false);
    expect(await initiateCollection(data)).toEqual({ success: false, error: message });
    expect(mockCalls).toEqual([]);
  });
});

describe('initiateCollection: cash', () => {
  it('records a pending collection for this bin, then marks the cash as received', async () => {
    const { initiateCollection } = load(false);
    const res = await initiateCollection({ ...BASE, paymentMode: 'cash' });
    expect(res).toEqual({ success: true, paymentId: 'pay-1', status: 'success', message: 'Cash payment recorded successfully' });
    const [insert, update] = mockCalls;
    expect(insert[0]).toBe('insert');
    expect(insert[1]).toBe('bin_payments');
    expect(insert[2][0]).toMatchObject({
      digital_bin_id: 'bin-12345678', collector_id: 'prof-1', total_bill: 26,
      payment_mode: 'cash', type: 'collection', status: 'pending', currency: 'GHS',
    });
    expect(update).toEqual(['update', 'bin_payments', { status: 'success' }, 'pay-1']);
  });

  it('reports a refused record instead of claiming success', async () => {
    mockInsertResult = () => ({ data: null, error: { message: 'You can only record payments for your own pickups' } });
    const { initiateCollection } = load(false);
    const res = await initiateCollection({ ...BASE, paymentMode: 'cash' });
    expect(res.success).toBe(false);
    expect(res.error).toMatch('You can only record payments for your own pickups');
    expect(mockCalls.filter(c => c[0] === 'update')).toEqual([]);
  });
});

describe('initiateCollection: MoMo through the gateway', () => {
  const MOMO = { ...BASE, paymentMode: 'momo', clientMomo: '0240000000', clientRSwitch: 'mtn' };

  it('asks the gateway to collect the bill against the payment record, and saves its references', async () => {
    const { initiateCollection } = load(true);
    const res = await initiateCollection(MOMO);
    expect(mockCalls.find(c => c[0] === 'gateway')[1]).toMatchObject({
      reference: 'pay-1', accountNumber: '0240000000', rSwitch: 'mtn', amount: 26, currency: 'GHS',
    });
    expect(mockCalls).toContainEqual(['update', 'bin_payments', { status: 'pending', gateway_reference: 'g-1', gateway_transaction_id: 't-1' }, 'pay-1']);
    expect(res).toMatchObject({ success: true, paymentId: 'pay-1', status: 'pending', transactionId: 't-1' });
  });

  it('marks the payment failed when the gateway refuses, and says so', async () => {
    mockGateway = () => ({ success: false, error: 'Insufficient balance' });
    const { initiateCollection } = load(true);
    const res = await initiateCollection(MOMO);
    expect(mockCalls).toContainEqual(['update', 'bin_payments', { status: 'failed', gateway_error: 'Insufficient balance' }, 'pay-1']);
    expect(res).toEqual({ success: false, error: 'Insufficient balance' });
  });

  it('never writes the full MoMo number to the console', async () => {
    let logged = '';
    const capture = (...args) => { logged += args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ') + '\n'; };
    console.log.mockImplementation(capture);
    console.warn.mockImplementation(capture);
    console.error.mockImplementation(capture);
    mockGateway = (params) => ({ success: true, status: 'pending', transactionId: 't-1', gatewayReference: 'g-1', accountNumber: params.accountNumber });
    const { initiateCollection } = load(true);
    await initiateCollection(MOMO);
    expect(mockCalls.find(c => c[0] === 'gateway')[1].accountNumber).toBe('0240000000');
    expect(logged).not.toContain('0240000000');
    expect(logged).toContain('024***00');
  });

  it('with the gateway switched off, leaves the payment pending and never calls it', async () => {
    const { initiateCollection } = load(false);
    const res = await initiateCollection(MOMO);
    expect(mockCalls.find(c => c[0] === 'gateway')).toBeUndefined();
    expect(res).toMatchObject({ success: true, paymentId: 'pay-1', status: 'pending' });
  });
});
