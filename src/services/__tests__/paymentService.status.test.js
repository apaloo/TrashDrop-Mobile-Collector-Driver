// Checking a client's payment for a digital bin (collector app, protected
// payout code: these tests only add cases). checkPaymentStatus reads the
// payment record; while it is still pending with a gateway transaction, it
// asks TrendiPay directly (the webhook may have failed) and records the
// answer. A status the collector app records is marked confirmed_by
// 'collector' by the database (td_guard_bin_payment), and only payments
// confirmed by the gateway or staff become withdrawable (td_withdrawable_items),
// so this path can show a result but never releases money by itself.

jest.mock('../../utils/logger', () => ({ logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } }));

let mockCalls = [];
let mockRecord = () => ({ data: { id: 'pay-1', status: 'pending', gateway_transaction_id: 't-1' }, error: null });
let mockGateway = () => ({ success: true, status: 'successful' });

jest.mock('../supabase', () => ({
  supabase: {
    from: (table) => ({
      select: () => ({ eq: (_c, id) => ({ single: () => { mockCalls.push(['read', table, id]); return Promise.resolve(mockRecord()); } }) }),
      update: (values) => ({ eq: (_c, id) => { mockCalls.push(['update', table, values, id]); return Promise.resolve({ error: null }); } }),
    }),
  },
}));
jest.mock('../trendiPayService', () => ({
  checkCollectionStatus: (txId, ref) => { mockCalls.push(['gateway', txId, ref]); return Promise.resolve(mockGateway()); },
}));

const load = (trendipay) => {
  process.env.VITE_ENABLE_TRENDIPAY = trendipay ? 'true' : 'false';
  let mod;
  jest.isolateModules(() => { mod = require('../paymentService'); });
  return mod;
};
const updates = () => mockCalls.filter((c) => c[0] === 'update');

beforeEach(() => {
  mockCalls = [];
  mockRecord = () => ({ data: { id: 'pay-1', status: 'pending', gateway_transaction_id: 't-1' }, error: null });
  mockGateway = () => ({ success: true, status: 'successful' });
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('checkPaymentStatus', () => {
  it('a settled payment is reported as recorded, without asking the gateway', async () => {
    mockRecord = () => ({ data: { id: 'pay-1', status: 'success', gateway_transaction_id: 't-1' }, error: null });
    const r = await load(true).checkPaymentStatus('pay-1');
    expect(r).toMatchObject({ success: true, status: 'success' });
    expect(mockCalls.some((c) => c[0] === 'gateway')).toBe(false);
  });

  it('still pending: asks TrendiPay, and records "successful" as success', async () => {
    const r = await load(true).checkPaymentStatus('pay-1');
    expect(mockCalls).toContainEqual(['gateway', 't-1', 'pay-1']);
    expect(r).toMatchObject({ success: true, status: 'success', payment: { id: 'pay-1', status: 'success' } });
    expect(updates()).toHaveLength(1);
    expect(updates()[0][2]).toMatchObject({ status: 'success' });
    // only the status: never amounts or who confirmed it (the database works that out)
    expect(Object.keys(updates()[0][2]).sort()).toEqual(['status', 'updated_at']);
  });

  it('records a gateway failure as failed', async () => {
    mockGateway = () => ({ success: true, status: 'failed' });
    const r = await load(true).checkPaymentStatus('pay-1');
    expect(r.status).toBe('failed');
    expect(updates()[0][2].status).toBe('failed');
  });

  it('a gateway answer that is still pending, unknown or unsuccessful changes nothing', async () => {
    for (const answer of [{ success: true, status: 'pending' }, { success: true, status: 'processing' }, { success: false, error: 'x' }]) {
      mockCalls = [];
      mockGateway = () => answer;
      const r = await load(true).checkPaymentStatus('pay-1');
      expect(r).toMatchObject({ success: true, status: 'pending' });
      expect(updates()).toEqual([]);
    }
  });

  it('a gateway that cannot be reached is not an error: the recorded status stands', async () => {
    mockGateway = () => { throw new Error('network'); };
    const r = await load(true).checkPaymentStatus('pay-1');
    expect(r).toMatchObject({ success: true, status: 'pending' });
    expect(updates()).toEqual([]);
  });

  it('with TrendiPay switched off, or no gateway transaction, the gateway is not asked', async () => {
    let r = await load(false).checkPaymentStatus('pay-1');
    expect(r.status).toBe('pending');
    mockRecord = () => ({ data: { id: 'pay-1', status: 'pending', gateway_transaction_id: null }, error: null });
    r = await load(true).checkPaymentStatus('pay-1');
    expect(r.status).toBe('pending');
    expect(mockCalls.some((c) => c[0] === 'gateway')).toBe(false);
  });

  it('a record that cannot be read is a failure, never a status', async () => {
    mockRecord = () => ({ data: null, error: { code: 'PGRST116', message: 'no rows' } });
    const r = await load(true).checkPaymentStatus('pay-x');
    expect(r).toEqual({ success: false, error: 'Database error: no rows' });
  });
});

describe('checkCollectionStatus and initiateDisbursement', () => {
  it('checkCollectionStatus passes through to TrendiPay, or says it is switched off', async () => {
    mockGateway = () => ({ success: true, status: 'successful' });
    await expect(load(true).checkCollectionStatus('t-9', 'ref-9')).resolves.toEqual({ success: true, status: 'successful' });
    expect(mockCalls).toContainEqual(['gateway', 't-9', 'ref-9']);
    await expect(load(false).checkCollectionStatus('t-9', 'ref-9')).resolves.toEqual({ success: false, error: 'TrendiPay is not enabled' });
  });

  it('checkCollectionStatus reports a gateway error instead of throwing', async () => {
    mockGateway = () => { throw new Error('timeout'); };
    await expect(load(true).checkCollectionStatus('t-9', 'r')).resolves.toEqual({ success: false, error: 'timeout' });
  });

  it('disbursement from the app is not available: it always says so, and sends nothing', async () => {
    await expect(load(true).initiateDisbursement('c-1', 50)).resolves.toEqual({ success: false, error: 'Disbursement feature coming soon' });
    expect(mockCalls).toEqual([]);
  });
});
