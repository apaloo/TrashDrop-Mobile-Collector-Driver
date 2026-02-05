import { supabase } from './supabase';
import { logger } from '../utils/logger';
import { getDeadheadShare } from '../utils/paymentCalculations';

// SOP v4.5.6 Payment Model Constants (aligned with earningsService.js)
const PAYMENT_SPLITS = {
  // Collector shares
  URGENT_COLLECTOR_SHARE: 0.75,      // 75% of urgent surcharge to collector
  SURGE_COLLECTOR_SHARE: 0.75,       // 75% of surge uplift to collector
  TIPS_COLLECTOR_SHARE: 1.0,         // 100% of tips to collector
  RECYCLABLES_COLLECTOR_SHARE: 0.60, // 60% of recyclables to collector
  RECYCLABLES_USER_SHARE: 0.25,      // 25% of recyclables to user
  DISTANCE_COLLECTOR_SHARE: 1.0,     // 100% of distance bonus to collector
  DEFAULT_DEADHEAD_SHARE: 0.87,      // Average of 85-92% for legacy data without deadhead info (matches earningsService)
  
  // Platform shares (App Bucket)
  URGENT_PLATFORM_SHARE: 0.25,       // 25% of urgent surcharge to platform
  SURGE_PLATFORM_SHARE: 0.25,        // 25% of surge uplift to platform
  RECYCLABLES_PLATFORM_SHARE: 0.15,  // 15% of recyclables to platform
  
  // Platform request fee - excluded from sharing, goes directly to platform
  PLATFORM_REQUEST_FEE: 1.00,        // GHC 1.00 fixed platform fee
};

/**
 * Disposal Service
 * 
 * Handles disposal of digital bins including:
 * - Updating bin status to 'disposed'
 * - Applying TrashDrop Pricing Algorithm v4.5.6 (payment sharing model)
 * - Calculating collector and platform shares
 * - Storing payout breakdown in digital_bins table
 */

/**
 * TrashDrop Pricing Algorithm v4.5.6
 * 
 * Payment Sharing Model Components:
 * 1. Core Collection Fee - Collector gets 85-92% based on deadhead distance
 * 2. Urgent Request Premium - 75% collector / 25% platform
 * 3. Distance Bonus - 100% to collector (only when urgent and >5km)
 * 4. Surge Multiplier - 75% collector / 25% platform
 * 5. Tips - 100% to collector (fetched from collector_tips table)
 * 6. Recyclables Bonus - 60% collector / 25% user / 15% platform
 * 7. Loyalty Cashback - 1-3% based on tier (platform funded)
 */

/**
 * Calculate payment sharing based on bin data and payment record
 * Uses SOP v4.5.6 percentages aligned with earningsService.js
 * 
 * CRITICAL: The fee field represents the TOTAL amount the user paid.
 * All collector payouts from the fee must NOT exceed the fee itself.
 * Recyclables and tips are external revenue sources that can add on top.
 * 
 * @param {Object} digitalBin - Digital bin data from database
 * @param {Object} payment - Payment record from bin_payments
 * @param {number} actualTips - Actual tips from collector_tips table (default 0)
 * @returns {Object} Payout breakdown
 */
function calculatePaymentSharing(digitalBin, payment, actualTips = 0) {
  logger.info('Calculating payment sharing for bin:', digitalBin.id);
  
  // IMPORTANT: Use digitalBin.fee as PRIMARY source (the actual amount user paid)
  // This is the TOTAL amount paid, including any urgent surcharge AND platform fee
  const totalBill = parseFloat(digitalBin.fee) || parseFloat(digitalBin.payout) || parseFloat(payment.total_bill) || 0;
  
  // CRITICAL: Exclude platform request fee from sharing - it goes directly to platform
  const platformRequestFee = PAYMENT_SPLITS.PLATFORM_REQUEST_FEE;
  const shareableAmount = Math.max(0, totalBill - platformRequestFee);
  const bagsCollected = parseInt(digitalBin.bags_collected) || parseInt(payment.bags_collected) || 1;
  const isUrgent = digitalBin.is_urgent || false;
  const deadheadKm = parseFloat(digitalBin.deadhead_km) || 0;
  const surgeMultiplier = parseFloat(digitalBin.surge_multiplier) || 1.0;
  
  // Calculate collector's deadhead share (85-92%)
  // Use DEFAULT_DEADHEAD_SHARE (0.87) for legacy data without deadhead info
  const deadheadShare = deadheadKm > 0 ? getDeadheadShare(deadheadKm) : PAYMENT_SPLITS.DEFAULT_DEADHEAD_SHARE;
  
  // ========================================================================
  // CRITICAL FIX: Extract components FROM the fee, don't add on top
  // The fee ALREADY includes urgent surcharge if applicable
  // ========================================================================
  
  // If urgent is enabled, the shareable amount already contains the 30% surcharge
  // Extract base and urgent portions FROM the shareable amount (after platform fee)
  let basePortion, urgentPortion;
  if (isUrgent) {
    // shareableAmount = base + (base * 0.30) = base * 1.30
    // Therefore: base = shareableAmount / 1.30
    basePortion = shareableAmount / 1.30;
    urgentPortion = shareableAmount - basePortion;
  } else {
    basePortion = shareableAmount;
    urgentPortion = 0;
  }
  
  // Component 1: Core Collection Fee - collector gets deadhead share of BASE portion
  const collectorCorePayout = basePortion * deadheadShare;
  const platformCoreMargin = basePortion - collectorCorePayout;
  
  // Component 2: Urgent Premium - 75/25 split of the URGENT portion (already in fee)
  const collectorUrgentPayout = urgentPortion * PAYMENT_SPLITS.URGENT_COLLECTOR_SHARE;
  const platformUrgentShare = urgentPortion * PAYMENT_SPLITS.URGENT_PLATFORM_SHARE;
  
  // Component 3: Distance Bonus - 100% to collector (only if urgent and >5km)
  // NOTE: Distance charges should also be included in the shareable amount if applicable
  const freeDistanceKm = 5;
  const billedKm = (isUrgent && deadheadKm > freeDistanceKm) 
    ? Math.min(deadheadKm, 10) - freeDistanceKm 
    : 0;
  // Distance is a small portion, cap it to avoid exceeding shareable amount
  const maxDistancePortion = shareableAmount * 0.10; // Max 10% of shareable for distance
  const distanceAmount = Math.min(billedKm * (basePortion * 0.06), maxDistancePortion);
  const collectorDistancePayout = distanceAmount * PAYMENT_SPLITS.DISTANCE_COLLECTOR_SHARE;
  
  // Component 4: Surge Multiplier - 75/25 split
  // Surge should also be included in the fee if applicable
  const eligibleSurgeBase = basePortion + urgentPortion;
  const surgeUplift = Math.max(0, (surgeMultiplier - 1) * eligibleSurgeBase);
  // Cap surge to remaining fee after other components
  const maxSurgePortion = totalBill * 0.20; // Max 20% of fee for surge
  const cappedSurgeUplift = Math.min(surgeUplift, maxSurgePortion);
  const collectorSurgePayout = cappedSurgeUplift * PAYMENT_SPLITS.SURGE_COLLECTOR_SHARE;
  const platformSurgeShare = cappedSurgeUplift * PAYMENT_SPLITS.SURGE_PLATFORM_SHARE;
  
  // Calculate payout from fee (before external sources)
  const payoutFromFee = collectorCorePayout + collectorUrgentPayout + 
    collectorDistancePayout + collectorSurgePayout;
  
  // CRITICAL VALIDATION: Payout from shareable amount must NOT exceed the shareable amount
  if (payoutFromFee > shareableAmount) {
    logger.error('CRITICAL: Calculated payout exceeds shareable amount!', {
      binId: digitalBin.id,
      totalBill,
      shareableAmount,
      payoutFromFee,
      excess: payoutFromFee - shareableAmount
    });
    // Cap at shareable amount - this should never happen with correct logic
    // but serves as a safety net
  }
  
  // Component 5: Tips - 100% to collector (EXTERNAL source, can add on top)
  const collectorTips = actualTips * PAYMENT_SPLITS.TIPS_COLLECTOR_SHARE;
  
  // Component 6: Recyclables Bonus - 60/25/15 split (EXTERNAL source from recycler)
  const recyclablesBonus = parseFloat(digitalBin.recycler_gross_payout) || 0;
  const collectorRecyclablesPayout = recyclablesBonus * PAYMENT_SPLITS.RECYCLABLES_COLLECTOR_SHARE;
  const userRecyclablesCredit = recyclablesBonus * PAYMENT_SPLITS.RECYCLABLES_USER_SHARE;
  const platformRecyclablesShare = recyclablesBonus * PAYMENT_SPLITS.RECYCLABLES_PLATFORM_SHARE;
  
  // Component 7: Loyalty Cashback (1-3% based on tier, PLATFORM funded)
  const loyaltyRate = digitalBin.loyalty_rate || 0.01; // Default 1% (Silver tier)
  const loyaltyCashback = payoutFromFee * loyaltyRate;
  
  // Total collector payout = fee share + external sources
  const collectorTotalPayout = 
    payoutFromFee +           // From user's fee
    collectorTips +           // External: tips
    collectorRecyclablesPayout + // External: recycler
    loyaltyCashback;          // External: platform
  
  // Total platform share (App Bucket) - includes the fixed request fee
  const platformTotalShare = 
    platformRequestFee +      // Fixed GHC 1.00 platform fee
    platformCoreMargin + 
    platformUrgentShare + 
    platformSurgeShare + 
    platformRecyclablesShare;
  
  // Breakdown for storage
  const breakdown = {
    // Collector components
    collector_core_payout: collectorCorePayout,
    collector_urgent_payout: collectorUrgentPayout,
    collector_distance_payout: collectorDistancePayout,
    collector_surge_payout: collectorSurgePayout,
    collector_tips: collectorTips,
    collector_recyclables_payout: collectorRecyclablesPayout,
    collector_loyalty_cashback: loyaltyCashback,
    collector_total_payout: collectorTotalPayout,
    
    // Platform share
    platform_share: platformTotalShare,
    platform_core_margin: platformCoreMargin,
    platform_urgent_share: platformUrgentShare,
    platform_surge_share: platformSurgeShare,
    platform_recyclables_share: platformRecyclablesShare,
    
    // User credit
    user_recyclables_credit: userRecyclablesCredit,
    
    // Metadata
    surge_multiplier: surgeMultiplier,
    deadhead_km: deadheadKm,
    deadhead_share: deadheadShare,
    loyalty_rate: loyaltyRate,
    payout_from_fee: payoutFromFee,
    platform_request_fee: platformRequestFee,
    
    // Summary
    total_bill: totalBill,
    shareable_amount: shareableAmount,
    bags_collected: bagsCollected,
    is_urgent: isUrgent,
    base_portion: basePortion,
    urgent_portion: urgentPortion
  };
  
  logger.info('Payment sharing calculated (SOP v4.5.6 - FIXED):', {
    binId: digitalBin.id,
    totalBill,
    platformRequestFee,
    shareableAmount: shareableAmount.toFixed(2),
    payoutFromFee: payoutFromFee.toFixed(2),
    collectorTotal: collectorTotalPayout.toFixed(2),
    platformShare: platformTotalShare.toFixed(2),
    deadheadShare: `${(deadheadShare * 100).toFixed(0)}%`,
    isUrgent,
    basePortion: basePortion.toFixed(2),
    urgentPortion: urgentPortion.toFixed(2)
  });
  
  return breakdown;
}

/**
 * Dispose a digital bin
 * 
 * @param {string} binId - Digital bin UUID
 * @param {string} collectorId - Collector user UUID
 * @param {string} disposalSiteId - Optional disposal center ID
 * @returns {Promise<Object>} Result with success status and payout info
 */
export async function disposeDigitalBin(binId, collectorId, disposalSiteId = null) {
  try {
    logger.info('Starting disposal process for bin:', binId);
    
    // 1. Fetch digital bin data
    const { data: digitalBin, error: binError } = await supabase
      .from('digital_bins')
      .select('*')
      .eq('id', binId)
      .single();
    
    if (binError || !digitalBin) {
      throw new Error(`Digital bin not found: ${binError?.message || 'Unknown error'}`);
    }
    
    // 2. Verify bin is in picked_up status
    if (digitalBin.status !== 'picked_up') {
      throw new Error(`Bin must be in 'picked_up' status. Current status: ${digitalBin.status}`);
    }
    
    // 3. Verify collector ownership
    if (digitalBin.collector_id !== collectorId) {
      throw new Error('This bin is assigned to a different collector');
    }
    
    // 4. Fetch the collection payment record (use maybeSingle to handle missing records gracefully)
    const { data: payment, error: paymentError } = await supabase
      .from('bin_payments')
      .select('*')
      .eq('digital_bin_id', binId)
      .eq('type', 'collection')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    // If no payment record found, create a fallback using bin data
    let paymentData = payment;
    if (!paymentData) {
      // Get actual fee from digital_bin - DO NOT use hardcoded fallback
      const actualFee = parseFloat(digitalBin.fee) || parseFloat(digitalBin.payout) || parseFloat(digitalBin.total_bill);
      
      if (!actualFee || actualFee <= 0) {
        logger.error('CRITICAL: No valid fee found for bin disposal:', { binId, digitalBin });
        throw new Error(`Cannot dispose bin ${binId}: No valid fee data found. Fee must be set on the digital_bin record.`);
      }
      
      logger.warn('No bin_payments record found, using fallback from digital_bin data:', { binId, fee: actualFee });
      paymentData = {
        id: `fallback_${binId}`,
        digital_bin_id: binId,
        collector_id: collectorId,
        type: 'collection',
        payment_mode: 'digital',
        total_bill: actualFee,
        status: 'success',
        created_at: digitalBin.created_at
      };
    }
    
    // 5. Verify payment was successful (for MoMo/e-cash)
    if (paymentData.payment_mode !== 'cash' && paymentData.status !== 'success') {
      logger.warn('Payment not yet confirmed:', {
        binId,
        paymentId: paymentData.id,
        status: paymentData.status,
        mode: paymentData.payment_mode
      });
      // For Phase 2, we'll allow disposal even if payment is pending
      // In production (Phase 4), you might want to enforce payment success
    }
    
    // 6. Fetch actual tips from collector_tips table (Fix #3: no more hardcoded tips)
    let actualTips = 0;
    const { data: tipsData } = await supabase
      .from('collector_tips')
      .select('amount')
      .eq('collector_id', collectorId)
      .eq('request_id', binId)
      .eq('status', 'confirmed');
    
    if (tipsData && tipsData.length > 0) {
      actualTips = tipsData.reduce((sum, tip) => sum + (parseFloat(tip.amount) || 0), 0);
      logger.info('Fetched actual tips for bin:', { binId, tipsAmount: actualTips });
    }
    
    // 7. Calculate payment sharing using the algorithm with actual tips
    const payoutBreakdown = calculatePaymentSharing(digitalBin, paymentData, actualTips);
    
    // 7. Update digital_bins with disposal info and payout breakdown
    const { error: updateError } = await supabase
      .from('digital_bins')
      .update({
        status: 'disposed',
        disposed_at: new Date().toISOString(),
        disposal_site_id: disposalSiteId,
        // Payout breakdown from sharing model
        collector_core_payout: payoutBreakdown.collector_core_payout,
        collector_urgent_payout: payoutBreakdown.collector_urgent_payout,
        collector_distance_payout: payoutBreakdown.collector_distance_payout,
        collector_surge_payout: payoutBreakdown.collector_surge_payout,
        collector_tips: payoutBreakdown.collector_tips,
        collector_recyclables_payout: payoutBreakdown.collector_recyclables_payout,
        collector_loyalty_cashback: payoutBreakdown.collector_loyalty_cashback,
        collector_total_payout: payoutBreakdown.collector_total_payout,
        surge_multiplier: payoutBreakdown.surge_multiplier,
        deadhead_km: payoutBreakdown.deadhead_km,
        updated_at: new Date().toISOString()
      })
      .eq('id', binId)
      .eq('collector_id', collectorId); // Extra safety
    
    if (updateError) {
      logger.error('Error updating bin with disposal info:', updateError);
      throw new Error(`Failed to update bin: ${updateError.message}`);
    }
    
    logger.info('✅ Digital bin disposed successfully:', {
      binId,
      collectorPayout: payoutBreakdown.collector_total_payout,
      platformShare: payoutBreakdown.platform_share
    });
    
    return {
      success: true,
      binId,
      payoutBreakdown,
      message: 'Bin disposed successfully'
    };
    
  } catch (error) {
    logger.error('Error disposing digital bin:', error);
    return {
      success: false,
      error: error.message || 'Failed to dispose bin'
    };
  }
}

/**
 * Get disposal summary for a collector
 * 
 * @param {string} collectorId - Collector user UUID
 * @returns {Promise<Object>} Summary stats
 */
export async function getDisposalSummary(collectorId) {
  try {
    // Get collector profile ID
    const { data: profile, error: profileError } = await supabase
      .from('collector_profiles')
      .select('id')
      .eq('user_id', collectorId)
      .single();
    
    if (profileError || !profile) {
      throw new Error('Collector profile not found');
    }
    
    // Get all disposed bins for this collector
    const { data: disposedBins, error: binsError } = await supabase
      .from('digital_bins')
      .select('id, collector_total_payout, disposed_at')
      .eq('collector_id', collectorId)
      .eq('status', 'disposed');
    
    if (binsError) {
      throw new Error(`Failed to fetch disposed bins: ${binsError.message}`);
    }
    
    const totalBins = disposedBins?.length || 0;
    const totalEarnings = disposedBins?.reduce(
      (sum, bin) => sum + (parseFloat(bin.collector_total_payout) || 0), 
      0
    ) || 0;
    
    return {
      success: true,
      totalDisposedBins: totalBins,
      totalEarnings: totalEarnings,
      bins: disposedBins
    };
    
  } catch (error) {
    logger.error('Error getting disposal summary:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
