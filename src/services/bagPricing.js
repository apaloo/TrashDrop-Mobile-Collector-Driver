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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Read a bag QR. Bags printed by the admin app hold
 * https://trashdrops.com/scan?batch=<batch id>&bag=<bag number>; older codes
 * may hold JSON with a bagId. Returns { batchId, bagNo } or { bagId }, or null.
 */
export function parseBagQr(text) {
  if (!text || typeof text !== 'string') return null;
  try {
    const data = JSON.parse(text);
    if (data && UUID_RE.test(data.bagId || '')) return { bagId: data.bagId };
  } catch {
    // not JSON
  }
  try {
    const url = new URL(text.trim());
    const batchId = url.searchParams.get('batch');
    const bagNo = parseInt(url.searchParams.get('bag'), 10);
    if (UUID_RE.test(batchId || '') && bagNo > 0) return { batchId, bagNo };
    const [kind, id] = url.pathname.split('/').filter(Boolean);
    if (kind === 'bag' && UUID_RE.test(id || '')) return { bagId: id };
  } catch {
    // not a URL
  }
  return null;
}

/**
 * Scan a bag for a prepaid pickup request. The database checks the bag belongs
 * to the request's household, links it, and recalculates the collector payout
 * (100% of the scanned bags' unit prices).
 * Returns { ok: true, bag, payout } or { ok: false, message }.
 */
export async function scanPickupBag(requestId, qrText) {
  const code = parseBagQr(qrText);
  if (!code) {
    return { ok: false, message: 'Not a TrashDrop bag QR code. Scan the code printed on the bag.' };
  }
  const { data, error } = await supabase.rpc('scan_pickup_request_bag', {
    p_request_id: String(requestId),
    p_batch_id: code.batchId || null,
    p_bag_no: code.bagNo || null,
    p_bag_id: code.bagId || null
  });
  if (error) {
    logger.warn('Bag scan refused:', error.message);
    return { ok: false, message: error.message || 'Could not record this bag. Try again.' };
  }
  return {
    ok: true,
    bag: {
      id: data.bag_id,
      batch_id: data.batch_id,
      bag_no: data.bag_no,
      unit_price: Number(data.unit_price) || 0,
      already_scanned: !!data.already_scanned
    },
    payout: data.payout || null
  };
}

/**
 * Work out and store the final payout of a prepaid pickup request (scanned
 * bags' unit prices + confirmed tips). Returns the payout breakdown.
 */
export async function finalizePickupPayout(requestId) {
  const { data, error } = await supabase.rpc('finalize_pickup_request_payout', { p_request_id: String(requestId) });
  if (error) throw error;
  return data;
}
