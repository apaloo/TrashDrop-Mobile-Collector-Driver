import { computeBinPaymentShares } from './paymentCalculations';

/**
 * One disposed digital bin's earnings, split for the Earnings breakdown
 * (protected payout display, owner-approved 2026-11-13).
 *
 * A standard bin earns what the database recorded as the collector's share
 * of the payment (bin_payments.collector_share, set by td_bin_collector_share;
 * docs/COLLECTOR_PAYOUTS.md in the household repository), split into the
 * base part and the urgent part. The payout columns stored on the bin are not
 * used: on bins disposed before 2026-11-12 they hold the app's old figures,
 * which added a 1% loyalty cashback and could add distance and surge bonuses
 * that nothing pays. A promotional bin earns its booked promotional payout.
 *
 * @param {Object} bin - digital_bins row
 * @param {{ totalBill: number, collectorShare?: number|null }} payment - its collection payment
 * @returns {{ core: number, urgent: number, distance: number, surge: number, tips: number, recyclables: number, loyalty: number }}
 */
export function binEarningBuckets(bin, { totalBill, collectorShare = null } = {}) {
  const zero = { core: 0, urgent: 0, distance: 0, surge: 0, tips: 0, recyclables: 0, loyalty: 0 };
  const tips = parseFloat(bin.collector_tips) || 0;

  if (bin.is_promotional === true) {
    const booked = parseFloat(bin.collector_core_payout);
    const share = parseFloat(collectorShare);
    return { ...zero, core: booked > 0 ? booked : (share > 0 ? share : 0), tips };
  }

  const fee = parseFloat(bin.fee) || 0;
  const counted = Math.min(parseFloat(totalBill) || 0, fee);
  const isUrgent = bin.is_urgent === true;
  const formula = computeBinPaymentShares({ totalBill: counted, isUrgent, deadheadKm: bin.deadhead_km });
  const recorded = parseFloat(collectorShare);
  const share = Number.isFinite(recorded) ? recorded : formula.collectorShare;
  const urgent = isUrgent ? Math.min(share, Number((formula.breakdown.urgentPortion * 0.75).toFixed(2))) : 0;
  return { ...zero, core: Number((share - urgent).toFixed(2)), urgent, tips };
}

/**
 * What a collector can expect to earn from a standard digital bin, for the job
 * card (protected payout display, owner-approved 2026-11-13). Same formula as
 * the database (td_bin_collector_share), from the bin's fee. The distance is
 * the one the database recorded when the bin was accepted; before that, the
 * collector's current straight-line distance to the bin, which is what the
 * database will record if they accept now; unknown pays 87%.
 *
 * @param {Object} request - the job as the card has it
 * @returns {{ amount: number, base: number, urgent: number, sharePercent: number, km: number|null, kmSource: 'recorded'|'current'|null, requestFee: number }}
 */
export function estimateBinEarning(request = {}) {
  const recorded = parseFloat(request.deadhead_km);
  const current = parseFloat(request.distanceValue);
  const km = recorded > 0 ? recorded : (current > 0 && current < 1000 ? current : null);
  const kmSource = recorded > 0 ? 'recorded' : (km != null ? 'current' : null);
  const isUrgent = request.is_urgent === true;
  const shares = computeBinPaymentShares({ totalBill: parseFloat(request.fee) || 0, isUrgent, deadheadKm: km || 0 });
  const booked = parseFloat(request.collector_total_payout);
  const amount = booked > 0 ? Math.min(shares.collectorShare, booked) : shares.collectorShare;
  const urgent = isUrgent ? Math.min(amount, Number((shares.breakdown.urgentPortion * 0.75).toFixed(2))) : 0;
  return {
    amount,
    base: Number((amount - urgent).toFixed(2)),
    urgent,
    sharePercent: Math.round((shares.breakdown.deadheadShare || 0.87) * 100),
    km,
    kmSource,
    requestFee: shares.breakdown.requestFee,
  };
}
