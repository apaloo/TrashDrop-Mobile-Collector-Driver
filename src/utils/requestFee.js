/**
 * The amount to show for a request: for a QR-bag pickup request, the sum of
 * its bags' unit prices when known (see services/bagPricing); otherwise its
 * fee (digital bins, or when the bag prices couldn't be loaded).
 */
export const displayFee = (request) => (
  request?.bag_price_total != null ? request.bag_price_total : (request?.fee || 0)
);
