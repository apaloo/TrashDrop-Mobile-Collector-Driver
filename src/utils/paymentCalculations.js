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
 * Calculate billed distance for distance charges
 * Only applies when urgent is enabled and distance > 5km
 * Caps at 10km total (so max 5km billed)
 * 
 * @param {boolean} urgentEnabled - Whether urgent service is enabled
 * @param {number} distanceKm - Total distance in kilometers
 * @returns {number} Billable distance in kilometers
 */
export function calculateBilledDistance(urgentEnabled, distanceKm) {
  if (!urgentEnabled) return 0;
  if (!distanceKm || distanceKm <= 5) return 0;
  
  // Only bill distance between 5km and 10km
  return Math.min(distanceKm, 10) - 5;
}

/**
 * Apply the "only-down" rule for distance anchoring
 * Ensures distance can never increase after initial quote (T0)
 * 
 * @param {number|null} anchorT0 - Distance at quote time (T0)
 * @param {number|null} anchorT1 - Distance at accept time (T1)
 * @param {number} currentDistance - Current calculated distance
 * @returns {number} Final distance applying only-down rule
 */
export function applyOnlyDownRule(anchorT0, anchorT1, currentDistance) {
  if (!anchorT0) return currentDistance; // First calculation, no anchor yet
  
  // Return the minimum of all available distances
  const distances = [anchorT0, anchorT1, currentDistance].filter(d => d !== null && d !== undefined);
  return Math.min(...distances);
}

/**
 * Calculate complete payment breakdown for a pickup request
 * 
 * @param {Object} params - Payment calculation parameters
 * @param {number} params.base - Base price (from bin size/volume)
 * @param {number} [params.onSite=0] - On-site surcharges (contamination, wait time, etc.)
 * @param {number} [params.discount=0] - Discounts applied (promos, vouchers)
 * @param {boolean} [params.urgentEnabled=false] - Whether urgent service enabled
 * @param {number} params.deadheadKm - Distance from collector to pickup
 * @param {number} [params.billedKm=0] - Billable distance for distance charges
 * @param {number} [params.surgeMultiplier=1.0] - Surge multiplier (1.0 = no surge)
 * @param {number} [params.requestFee=1.0] - Platform request fee
 * @param {number} [params.taxes=0] - Tax amount
 * @param {number} [params.tips=0] - Tips amount
 * @param {number} [params.recyclerGross=0] - Gross payout from recycler
 * @param {number} [params.loyaltyRate=0] - Loyalty cashback rate (0.01-0.03)
 * @returns {Object} Complete payment breakdown
 */
export function calculatePaymentBreakdown({
  base,
  onSite = 0,
  discount = 0,
  urgentEnabled = false,
  deadheadKm = 0,
  billedKm = 0,
  surgeMultiplier = 1.0,
  requestFee = 1.0,
  taxes = 0,
  tips = 0,
  recyclerGross = 0,
  loyaltyRate = 0
}) {
  // Input validation
  if (!base || base <= 0) {
    throw new Error('Base price must be greater than 0');
  }
  
  // 1. Calculate core amount (non-distance base)
  const nonDistanceCore = Math.max(0, base + onSite - discount);
  
  // 2. Calculate urgent surcharge (30% of base)
  const urgentAmt = urgentEnabled ? 0.30 * base : 0;
  
  // 3. Calculate distance charges (only if urgent enabled)
  const perKm = urgentEnabled ? 0.06 * base : 0;
  const distanceAmt = billedKm * perKm;
  
  // 4. Calculate collector's core share based on deadhead
  const deadheadShare = getDeadheadShare(deadheadKm);
  const collectorCore = nonDistanceCore * deadheadShare;
  
  // 5. Calculate platform's core margin
  const platformCore = nonDistanceCore - collectorCore;
  
  // 6. Calculate urgent split (75/25)
  const collectorUrg = 0.75 * urgentAmt;
  const platformUrg = 0.25 * urgentAmt;
  
  // 7. Distance bonus goes 100% to collector
  const collectorDist = distanceAmt;
  
  // 8. Calculate surge uplift and split (75/25)
  const eligibleSurgeBase = nonDistanceCore + urgentAmt + distanceAmt;
  const surgeUplift = Math.max(0, (surgeMultiplier - 1) * eligibleSurgeBase);
  const collectorSurge = 0.75 * surgeUplift;
  const platformSurge = 0.25 * surgeUplift;
  
  // 9. Recyclables split (60/25/15)
  const collectorRecyclables = 0.60 * recyclerGross;
  const userRecyclables = 0.25 * recyclerGross;
  const platformRecyclables = 0.15 * recyclerGross;
  
  // 10. Calculate loyalty cashback (before adding tips/recyclables)
  const collectorPayoutPreLoyalty = collectorCore + collectorUrg + collectorDist + collectorSurge;
  const loyaltyCashback = loyaltyRate * collectorPayoutPreLoyalty;
  
  // 11. Calculate total collector payout
  const collectorTotal = collectorPayoutPreLoyalty + loyaltyCashback + tips + collectorRecyclables;
  
  // 12. Calculate total platform revenue (App Bucket)
  const appBucket = platformCore + platformUrg + platformSurge + requestFee + platformRecyclables;
  
  // 13. Calculate total user payment
  const userTotal = nonDistanceCore + urgentAmt + distanceAmt + requestFee + taxes;
  
  return {
    // User-side totals
    userTotal,
    base,
    onSite,
    discount,
    urgentAmt,
    distanceAmt,
    surgeUplift,
    requestFee,
    taxes,
    
    // Collector-side breakdown
    collectorTotal,
    collectorCore,
    collectorUrg,
    collectorDist,
    collectorSurge,
    collectorRecyclables,
    loyaltyCashback,
    tips,
    
    // Platform-side revenue
    appBucket,
    platformCore,
    platformUrg,
    platformSurge,
    platformRecyclables,
    
    // Recyclables breakdown
    userRecyclables,
    
    // Metadata
    deadheadShare,
    deadheadKm,
    surgeMultiplier,
    nonDistanceCore
  };
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
 * Get loyalty tier name from cashback rate
 * 
 * @param {number} cashbackRate - Cashback rate (0.01, 0.02, 0.03)
 * @returns {string} Tier name (Silver, Gold, Platinum)
 */
export function getLoyaltyTierName(cashbackRate) {
  if (cashbackRate >= 0.03) return 'Platinum';
  if (cashbackRate >= 0.02) return 'Gold';
  return 'Silver';
}

/**
 * Format currency for display
 * 
 * @param {number} amount - Amount in local currency
 * @param {boolean} [showSymbol=true] - Whether to show currency symbol
 * @returns {string} Formatted currency string
 */
export function formatPayout(amount, showSymbol = true) {
  if (!amount && amount !== 0) return showSymbol ? '₵0' : '0';
  
  const formatted = Math.round(amount).toLocaleString();
  return showSymbol ? `₵${formatted}` : formatted;
}

/**
 * Calculate estimated payout for display before acceptance
 * Uses conservative estimates for unknown values
 * 
 * @param {Object} request - Pickup request object
 * @param {number} collectorDeadheadKm - Collector's distance to pickup
 * @returns {Object} Estimated payout breakdown
 */
export function estimateCollectorPayout(request, collectorDeadheadKm) {
  const base = request.base_amount || request.fee || 0;
  
  // Use existing calculated values or defaults
  const billedKm = request.distance_billed_km || 
    calculateBilledDistance(request.urgent_enabled, collectorDeadheadKm);
  
  const breakdown = calculatePaymentBreakdown({
    base,
    onSite: request.onsite_surcharges || 0,
    discount: request.discount_amount || 0,
    urgentEnabled: request.urgent_enabled || false,
    deadheadKm: collectorDeadheadKm,
    billedKm,
    surgeMultiplier: request.surge_multiplier || 1.0,
    requestFee: request.request_fee || 1.0,
    taxes: request.taxes || 0,
    tips: 0, // Unknown until completion
    recyclerGross: 0, // Unknown until settlement
    loyaltyRate: 0 // Will be added later
  });
  
  return {
    ...breakdown,
    isEstimate: true,
    excludesTips: true,
    excludesRecyclables: true,
    excludesLoyalty: true
  };
}
