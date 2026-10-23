import { withBagPrices } from '../bagPricing';
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
