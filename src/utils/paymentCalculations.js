/**
 * Payment Calculation Utilities - SOP v4.5.6
 * 
 * Pure calculation functions for collector payout breakdown.
 * These functions implement the TrashDrop payment model where:
 * - Collectors receive 85-92% of core based on deadhead distance
 * - Urgent split: 75% collector / 25% platform
 * - Distance bonus: 100% collector (only when urgent and >5km)
 * - Surge split: 75% collector / 25% platform
 * - Tips: 100% collector
 * - Recyclables: 60% collector / 25% user / 15% platform
 * - Loyalty cashback: 1-3% based on tier (from platform App Bucket)
 */

/**
 * Calculate collector's share based on deadhead distance (SOP v4.5.6)
 * LONGER deadhead = HIGHER share (compensates for travel cost)
 * 
 * | Deadhead Distance | Collector Share |
 * |-------------------|-----------------|
 * | 0-2 km            | 85%             |
 * | 2-5 km            | 87%             |
 * | 5-10 km           | 89%             |
 * | 10+ km            | 92%             |
 * 
 * @param {number} deadheadKm - Distance from collector to pickup in kilometers
 * @returns {number} Share percentage (0.85 to 0.92)
 */
export function getDeadheadShare(deadheadKm) {
  if (!deadheadKm || deadheadKm <= 2) return 0.85;
  if (deadheadKm <= 5) return 0.87;
  if (deadheadKm <= 10) return 0.89;
  return 0.92; // 10+ km
}

/**
 * Compute collector_share and platform_share for a digital bin collection payment.
 *
 * This is the canonical formula used BOTH when recording a payment
 * (paymentService.js) and when reading earnings (earningsService.js fallback).
 * Keeping it in one place guarantees both services stay in sync.
 *
 * Formula (SOP v4.5.6):
 *  - Platform request fee (GHC 1.00) is excluded from sharing (100% platform)
 *  - Remaining shareable = totalBill - requestFee
 *  - If urgent: shareable = base * 1.30; split urgent portion 75/25
 *  - Collector core = base * deadheadShare (85-92%)
 *  - Platform core  = base * (1 - deadheadShare)
 *
 * @param {Object} params
 * @param {number} params.totalBill - Amount actually collected from client (GHS)
 * @param {boolean} [params.isUrgent=false] - Urgent flag from digital_bins
 * @param {number} [params.deadheadKm=0] - Deadhead km from digital_bins
 * @param {number} [params.requestFee=1.0] - Platform request fee
 * @returns {{ collectorShare: number, platformShare: number, breakdown: Object }}
 */
export function computeBinPaymentShares({
  totalBill,
  isUrgent = false,
  deadheadKm = 0,
  requestFee = 1.0
}) {
  const bill = parseFloat(totalBill) || 0;
  const fee = parseFloat(requestFee) || 0;

  // Request fee goes 100% to platform
  const shareableAmount = Math.max(0, bill - fee);

  if (shareableAmount === 0) {
    return {
      collectorShare: 0,
      platformShare: Math.min(bill, fee),
      breakdown: {
        shareableAmount: 0,
        basePortion: 0,
        urgentPortion: 0,
        collectorCore: 0,
        collectorUrgent: 0,
        platformCore: 0,
        platformUrgent: 0,
        requestFee: Math.min(bill, fee),
        deadheadShare: 0
      }
    };
  }

  const km = parseFloat(deadheadKm) || 0;
  const deadheadShare = km > 0 ? getDeadheadShare(km) : 0.87; // Default average

  // Split shareable into base and urgent portions (fee already includes 30% urgent surcharge)
  let basePortion, urgentPortion;
  if (isUrgent) {
    basePortion = shareableAmount / 1.30;
    urgentPortion = shareableAmount - basePortion;
  } else {
    basePortion = shareableAmount;
    urgentPortion = 0;
  }

  // Collector portions
  const collectorCore = basePortion * deadheadShare;
  const collectorUrgent = urgentPortion * 0.75; // 75% of urgent to collector
  const collectorShare = collectorCore + collectorUrgent;

  // Platform portions
  const platformCore = basePortion * (1 - deadheadShare);
  const platformUrgent = urgentPortion * 0.25; // 25% of urgent to platform
  const platformShare = platformCore + platformUrgent + fee;

  return {
    collectorShare: Number(collectorShare.toFixed(2)),
    platformShare: Number(platformShare.toFixed(2)),
    breakdown: {
      shareableAmount,
      basePortion,
      urgentPortion,
      collectorCore,
      collectorUrgent,
      platformCore,
      platformUrgent,
      requestFee: fee,
      deadheadShare
    }
  };
}

/**
 * Promotional Pricing — New User Fixed Fee Schedule
 * 
 * For market penetration, new users pay a reduced fixed fee for their first
 * 5 digital bin requests. The collector receives a guaranteed higher payout,
 * with the platform subsidising the difference from a dedicated marketing fund.
 *
 * The `is_promotional` flag on the digital_bins record signals whether
 * promotional pricing should override the SOP v4.5.6 formula.
 *
 * NOTE: If fee schedule changes, update the `promotional_fee_schedule` DB
 * table too — this constant is the collector-app fallback only.
 */
export const PROMOTIONAL_FEE_SCHEDULE = {
  120: { clientFee: 18.00, collectorPayout: 30.00, platformSubsidy: 12.00 },
  240: { clientFee: 22.00, collectorPayout: 40.00, platformSubsidy: 18.00 },
  360: { clientFee: 48.00, collectorPayout: 95.00, platformSubsidy: 47.00 },
  660: { clientFee: 88.00, collectorPayout: 115.00, platformSubsidy: 27.00 },
  1100: { clientFee: 98.00, collectorPayout: 135.00, platformSubsidy: 37.00 },
};

/**
 * A promotional bin's collector payout and client fee.
 *
 * The database prices promotional bins when they are booked (household app
 * migration 20261024000000_server_side_bin_pricing): the
 * promotional_fee_schedule rate × bags, stored in collector_core_payout and
 * fee. Use those; the built-in table × bags is only for bins without them.
 *
 * @param {Object} params
 * @param {number} params.binSizeLiters
 * @param {number} [params.bagCount=1]
 * @param {number} [params.storedPayout] - the bin's collector_core_payout as booked
 * @param {number} [params.storedFee] - the bin's fee as booked
 * @returns {{ collectorPayout: number, clientFee: number, platformSubsidy: number }}
 */
export function promotionalPayout({ binSizeLiters, bagCount = 1, storedPayout, storedFee }) {
  const schedule = PROMOTIONAL_FEE_SCHEDULE[parseInt(binSizeLiters)] || PROMOTIONAL_FEE_SCHEDULE[120];
  const bags = Math.max(1, parseInt(bagCount) || 1);
  const stored = parseFloat(storedPayout);
  const fee = parseFloat(storedFee);
  const collectorPayout = stored > 0 ? stored : schedule.collectorPayout * bags;
  const clientFee = fee > 0 ? fee : schedule.clientFee * bags;
  return {
    collectorPayout: Number(collectorPayout.toFixed(2)),
    clientFee: Number(clientFee.toFixed(2)),
    platformSubsidy: Number(Math.max(0, collectorPayout - clientFee).toFixed(2)),
  };
}

/**
 * Compute collector_share and platform_share for a promotional digital bin.
 *
 * Promotional bins bypass the SOP v4.5.6 deadhead/urgent formula entirely.
 * The collector receives the payout set when the bin was booked (the
 * promotional rate × bags, see promotionalPayout). The platform covers the
 * subsidy (collector payout − client fee) from the marketing fund.
 *
 * @param {Object} params
 * @param {number} params.totalBill - Amount actually collected from the client (GHS)
 * @param {number} params.binSizeLiters - Bin size (120, 240, or 360)
 * @param {number} [params.bagCount=1] - Bags booked
 * @param {number} [params.storedPayout] - The bin's collector_core_payout as booked
 * @returns {{ collectorShare: number, platformShare: number, platformSubsidy: number, isPromotional: true, breakdown: Object }}
 */
export function computePromotionalShares({ totalBill, binSizeLiters, bagCount = 1, storedPayout }) {
  const bill = parseFloat(totalBill) || 0;
  const size = parseInt(binSizeLiters) || 120;

  const promo = promotionalPayout({ binSizeLiters: size, bagCount, storedPayout });
  const schedule = { clientFee: promo.clientFee, collectorPayout: promo.collectorPayout, platformSubsidy: promo.platformSubsidy };

  // Collector gets the guaranteed payout regardless of what the client paid
  const collectorShare = schedule.collectorPayout;

  // Platform subsidy = collector payout − what the client paid (funded from marketing bucket)
  const platformSubsidy = Math.max(0, collectorShare - bill);

  // Platform net share from the client fee (may be 0 or slightly negative after subsidy)
  // The client's full payment goes toward the collector payout; subsidy covers the gap.
  const platformShareFromBill = Math.max(0, bill - collectorShare);

  return {
    collectorShare: Number(collectorShare.toFixed(2)),
    platformShare: Number(platformShareFromBill.toFixed(2)),
    platformSubsidy: Number(platformSubsidy.toFixed(2)),
    isPromotional: true,
    breakdown: {
      binSizeLiters: size,
      clientFee: schedule.clientFee,
      collectorPayout: schedule.collectorPayout,
      platformSubsidy: schedule.platformSubsidy,
      totalBillCollected: bill,
      shareableAmount: bill,
      collectorCore: collectorShare,
      collectorUrgent: 0,
      platformCore: platformShareFromBill,
      platformUrgent: 0,
      requestFee: 0,
      deadheadShare: 1.0
    }
  };
}

