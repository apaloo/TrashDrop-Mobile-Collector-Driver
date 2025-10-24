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
 * Calculate collector's core payout share based on deadhead distance
 * Implements the deadhead curve: 85% at ≤5km → 92% at 10km
 * 
 * @param {number} deadheadKm - Distance from collector to pickup in kilometers
 * @returns {number} Share percentage (0.85 to 0.92)
 */
export function getDeadheadShare(deadheadKm) {
  if (!deadheadKm || deadheadKm <= 5) return 0.85;
  if (deadheadKm >= 10) return 0.92;
  
  // Linear interpolation between 5km and 10km
  const t = (deadheadKm - 5) / 5;
  return 0.85 + t * (0.92 - 0.85);
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
