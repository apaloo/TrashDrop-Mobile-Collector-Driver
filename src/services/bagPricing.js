import { supabase } from './supabase';
import { logger } from '../utils/logger';

/**
 * Bag prices for QR-bag pickup requests (shown on the request card).
 *
 * A pickup request's fee is the sum of the unit prices of the bags it covers;
 * each bag has its own unit_price. The prices come from the
 * get_pickup_request_bag_prices database function (collectors can't read
 * other users' bags directly). Digital bins keep their own `fee`.
 *
 * Display only: payouts are calculated elsewhere and are not affected.
 */

/**
 * Add bag_unit_prices / bag_price_total / bags to the pickup requests in `requests`.
 * Returns a new array; on any error (e.g. the function isn't installed yet)
 * the requests are returned unchanged and the card falls back to `fee`.
 */
export async function withBagPrices(requests) {
  if (!Array.isArray(requests) || requests.length === 0) return requests;

  const ids = requests
    .filter(r => r && r.source_type !== 'digital_bin' && r.id)
    .map(r => String(r.id));
  if (ids.length === 0) return requests;

  try {
    const { data, error } = await supabase.rpc('get_pickup_request_bag_prices', { p_request_ids: ids });
    if (error) throw error;

    const byId = new Map((data || []).map(row => [String(row.request_id), row]));
    return requests.map(request => {
      const row = request && byId.get(String(request.id));
      if (!row || !Array.isArray(row.unit_prices) || row.unit_prices.length === 0) return request;
      const unitPrices = row.unit_prices.map(Number);
      return {
        ...request,
        bags: row.bag_count || request.bags,
        bag_unit_prices: unitPrices,
        bag_price_total: Number(row.total) || unitPrices.reduce((sum, price) => sum + price, 0)
      };
    });
  } catch (error) {
    logger.warn('Could not load bag prices, showing request fee instead:', error?.message || error);
    return requests;
  }
}
