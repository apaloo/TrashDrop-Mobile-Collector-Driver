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
  
  // Platform shares (App Bucket)
  URGENT_PLATFORM_SHARE: 0.25,       // 25% of urgent surcharge to platform
  SURGE_PLATFORM_SHARE: 0.25,        // 25% of surge uplift to platform
  RECYCLABLES_PLATFORM_SHARE: 0.15,  // 15% of recyclables to platform
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
 * @param {Object} digitalBin - Digital bin data from database
 * @param {Object} payment - Payment record from bin_payments
 * @param {number} actualTips - Actual tips from collector_tips table (default 0)
 * @returns {Object} Payout breakdown
 */
function calculatePaymentSharing(digitalBin, payment, actualTips = 0) {
  logger.info('Calculating payment sharing for bin:', digitalBin.id);
  
  const totalBill = parseFloat(payment.total_bill) || 0;
  const bagsCollected = parseInt(payment.bags_collected) || 1;
  const isUrgent = digitalBin.is_urgent || false;
  const deadheadKm = parseFloat(digitalBin.deadhead_km) || 0;
  const surgeMultiplier = parseFloat(digitalBin.surge_multiplier) || 1.0;
  
  // Component 1: Core Collection Fee (base rate per bag)
  const baseRatePerBag = 5.0; // GHS 5 per bag
  const coreCollectionFee = baseRatePerBag * bagsCollected;
  
  // Calculate collector's core share based on deadhead distance (85-92%)
  const deadheadShare = getDeadheadShare(deadheadKm);
  const collectorCorePayout = coreCollectionFee * deadheadShare;
  const platformCoreMargin = coreCollectionFee - collectorCorePayout;
  
  // Component 2: Urgent Premium (30% of core if urgent) - 75/25 split
  const urgentAmount = isUrgent ? coreCollectionFee * 0.30 : 0;
  const collectorUrgentPayout = urgentAmount * PAYMENT_SPLITS.URGENT_COLLECTOR_SHARE;
  const platformUrgentShare = urgentAmount * PAYMENT_SPLITS.URGENT_PLATFORM_SHARE;
  
  // Component 3: Distance Bonus - 100% to collector (only if urgent and >5km)
  const freeDistanceKm = 5;
  const billedKm = (isUrgent && deadheadKm > freeDistanceKm) 
    ? Math.min(deadheadKm, 10) - freeDistanceKm 
    : 0;
  const perKmRate = isUrgent ? coreCollectionFee * 0.06 : 0;
  const distanceAmount = billedKm * perKmRate;
  const collectorDistancePayout = distanceAmount * PAYMENT_SPLITS.DISTANCE_COLLECTOR_SHARE;
  
  // Component 4: Surge Multiplier - 75/25 split
  const eligibleSurgeBase = coreCollectionFee + urgentAmount + distanceAmount;
  const surgeUplift = Math.max(0, (surgeMultiplier - 1) * eligibleSurgeBase);
  const collectorSurgePayout = surgeUplift * PAYMENT_SPLITS.SURGE_COLLECTOR_SHARE;
  const platformSurgeShare = surgeUplift * PAYMENT_SPLITS.SURGE_PLATFORM_SHARE;
  
  // Component 5: Tips - 100% to collector (use actual tips, not hardcoded)
  const tipsAmount = actualTips;
  const collectorTips = tipsAmount * PAYMENT_SPLITS.TIPS_COLLECTOR_SHARE;
  
  // Component 6: Recyclables Bonus - 60/25/15 split (collector/user/platform)
  const recyclablesBonus = bagsCollected * 2.0; // GHS 2 per bag estimate
  const collectorRecyclablesPayout = recyclablesBonus * PAYMENT_SPLITS.RECYCLABLES_COLLECTOR_SHARE;
  const userRecyclablesCredit = recyclablesBonus * PAYMENT_SPLITS.RECYCLABLES_USER_SHARE;
  const platformRecyclablesShare = recyclablesBonus * PAYMENT_SPLITS.RECYCLABLES_PLATFORM_SHARE;
  
  // Component 7: Loyalty Cashback (1-3% based on tier, default 1%)
  const collectorPayoutPreLoyalty = collectorCorePayout + collectorUrgentPayout + 
    collectorDistancePayout + collectorSurgePayout;
  const loyaltyRate = digitalBin.loyalty_rate || 0.01; // Default 1% (Silver tier)
  const loyaltyCashback = collectorPayoutPreLoyalty * loyaltyRate;
  
  // Total collector payout
  const collectorTotalPayout = 
    collectorCorePayout + 
    collectorUrgentPayout + 
    collectorDistancePayout + 
    collectorSurgePayout + 
    collectorTips + 
    collectorRecyclablesPayout + 
    loyaltyCashback;
  
  // Total platform share (App Bucket)
  const platformTotalShare = 
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
    
    // Summary
    total_bill: totalBill,
    bags_collected: bagsCollected,
    is_urgent: isUrgent
  };
  
  logger.info('Payment sharing calculated (SOP v4.5.6):', {
    binId: digitalBin.id,
    totalBill,
    collectorPayout: collectorTotalPayout.toFixed(2),
    platformShare: platformTotalShare.toFixed(2),
    deadheadShare: `${(deadheadShare * 100).toFixed(0)}%`
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
    
    // 4. Fetch the collection payment record
    const { data: payment, error: paymentError } = await supabase
      .from('bin_payments')
      .select('*')
      .eq('digital_bin_id', binId)
      .eq('type', 'collection')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (paymentError || !payment) {
      throw new Error(`Payment record not found: ${paymentError?.message || 'Unknown error'}`);
    }
    
    // 5. Verify payment was successful (for MoMo/e-cash)
    if (payment.payment_mode !== 'cash' && payment.status !== 'success') {
      logger.warn('Payment not yet confirmed:', {
        binId,
        paymentId: payment.id,
        status: payment.status,
        mode: payment.payment_mode
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
    const payoutBreakdown = calculatePaymentSharing(digitalBin, payment, actualTips);
    
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
