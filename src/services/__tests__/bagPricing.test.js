import { withBagPrices, parseBagQr, scanPickupBag, finalizePickupPayout } from '../bagPricing';
import { displayFee } from '../../utils/requestFee';
import { supabase } from '../supabase';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

jest.mock('../supabase', () => ({
  supabase: { rpc: jest.fn() }
}));

const bag = { id: 'req-2', source_type: 'pickup_request', fee: 0, bags: 1 };
const bin = { id: 'bin-1', source_type: 'digital_bin', fee: 23 };

beforeEach(() => jest.clearAllMocks());

describe('withBagPrices', () => {
  it('adds each bag\'s unit price and their total to QR-bag requests only', async () => {
    supabase.rpc.mockResolvedValue({
      data: [{ request_id: 'req-2', bag_count: 2, unit_prices: ['30.00', '50.00'], total: '80.00' }],
      error: null
    });

    const [withPrices, binAfter] = await withBagPrices([bag, bin]);

    expect(supabase.rpc).toHaveBeenCalledWith('get_pickup_request_bag_prices', { p_request_ids: ['req-2'] });
    expect(withPrices).toMatchObject({ bags: 2, bag_unit_prices: [30, 50], bag_price_total: 80 });
    expect(binAfter).toBe(bin);
    expect(displayFee(withPrices)).toBe(80);
    expect(displayFee(binAfter)).toBe(23);
  });

  it('keeps the requests unchanged (card shows fee) when prices can\'t be loaded', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'function does not exist' } });
    const list = [bag, bin];
    expect(await withBagPrices(list)).toBe(list);
    expect(displayFee(bag)).toBe(0);
  });

  it('skips the call when there are no QR-bag requests', async () => {
    await withBagPrices([bin]);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});

describe('parseBagQr', () => {
  const batch = '8deb9958-fe9c-407e-810f-1a2c573c86e6';

  it('reads the printed bag QR (batch id + bag number)', () => {
    expect(parseBagQr(`https://trashdrops.com/scan?batch=${batch}&bag=7&email=a%40b.com`)).toEqual({ batchId: batch, bagNo: 7 });
  });

  it('reads older JSON and /bag/<id> codes', () => {
    expect(parseBagQr(JSON.stringify({ source: 'trashdrop', bagId: batch }))).toEqual({ bagId: batch });
    expect(parseBagQr(`https://trashdrop.app/bag/${batch}`)).toEqual({ bagId: batch });
  });

  it('rejects anything else, including the batch-only QR and digital bin codes', () => {
    expect(parseBagQr(`https://trashdrops.com/scan?batch=${batch}`)).toBeNull();
    expect(parseBagQr(`https://trashdrop.app/bin/${batch}`)).toBeNull();
    expect(parseBagQr('hello')).toBeNull();
  });
});

describe('scanPickupBag', () => {
  const qr = 'https://trashdrops.com/scan?batch=8deb9958-fe9c-407e-810f-1a2c573c86e6&bag=2';

  it('records the bag in the database and returns its price and the new payout', async () => {
    supabase.rpc.mockResolvedValue({
      data: { bag_id: 'bag-2', batch_id: 'b1', bag_no: 2, unit_price: '30.00', already_scanned: false, payout: { total: 60, model: 'prepaid_bags' } },
      error: null
    });

    const result = await scanPickupBag('req-1', qr);

    expect(supabase.rpc).toHaveBeenCalledWith('scan_pickup_request_bag', {
      p_request_id: 'req-1', p_batch_id: '8deb9958-fe9c-407e-810f-1a2c573c86e6', p_bag_no: 2, p_bag_id: null
    });
    expect(result).toEqual({
      ok: true,
      bag: { id: 'bag-2', batch_id: 'b1', bag_no: 2, unit_price: 30, already_scanned: false },
      payout: { total: 60, model: 'prepaid_bags' }
    });
  });

  it('passes the database refusal on to the collector', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'This bag belongs to another household' } });
    expect(await scanPickupBag('req-1', qr)).toEqual({ ok: false, message: 'This bag belongs to another household' });
  });

  it('does not call the database for a code that is not a bag QR', async () => {
    expect((await scanPickupBag('req-1', 'not a bag')).ok).toBe(false);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});

describe('finalizePickupPayout', () => {
  it('returns the database payout and throws when it fails', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: { total: 65, model: 'prepaid_bags' }, error: null });
    expect(await finalizePickupPayout('req-1')).toEqual({ total: 65, model: 'prepaid_bags' });
    expect(supabase.rpc).toHaveBeenCalledWith('finalize_pickup_request_payout', { p_request_id: 'req-1' });

    supabase.rpc.mockResolvedValueOnce({ data: null, error: new Error('not assigned to you') });
    await expect(finalizePickupPayout('req-1')).rejects.toThrow('not assigned to you');
  });
});
