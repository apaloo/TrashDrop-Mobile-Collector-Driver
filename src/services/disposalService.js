import { supabase } from './supabase';
import { logger } from '../utils/logger';

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
 * 1. Core Collection Fee (base rate)
 * 2. Urgent Request Premium (if applicable)
 * 3. Distance Premium (deadhead km)
 * 4. Surge Multiplier (demand-based)
 * 5. Tips (optional, 100% to collector)
 * 6. Recyclables Bonus (material value)
 * 7. Loyalty Cashback (collector retention)
 * 
 * Platform Share:
 * - Base: 20% of (core + urgent + distance + surge)
 * - Tips: 0% (100% to collector)
 * - Recyclables: 10% (90% to collector)
 * - Loyalty: Funded by platform
 */

/**
 * Calculate payment sharing based on bin data and payment record
 * 
 * @param {Object} digitalBin - Digital bin data from database
 * @param {Object} payment - Payment record from bin_payments
 * @returns {Object} Payout breakdown
 */
function calculatePaymentSharing(digitalBin, payment) {
  logger.info('Calculating payment sharing for bin:', digitalBin.id);
  
  const totalBill = parseFloat(payment.total_bill) || 0;
  const bagsCollected = parseInt(payment.bags_collected) || 1;
  const isUrgent = digitalBin.is_urgent || false;
  const deadheadKm = parseFloat(digitalBin.deadhead_km) || 0;
  const surgeMultiplier = parseFloat(digitalBin.surge_multiplier) || 1.0;
  
  // Component 1: Core Collection Fee (base rate per bag)
  const baseRatePerBag = 5.0; // GHS 5 per bag
  const coreCollectionFee = baseRatePerBag * bagsCollected;
  
  // Component 2: Urgent Premium (50% bonus if urgent)
  const urgentPremium = isUrgent ? coreCollectionFee * 0.5 : 0;
  
  // Component 3: Distance Premium (GHS 2 per km beyond 5km)
  const freeDistanceKm = 5;
  const distancePremium = deadheadKm > freeDistanceKm 
    ? (deadheadKm - freeDistanceKm) * 2.0 
    : 0;
  
  // Component 4: Surge Multiplier (applied to base components)
  const baseBeforeSurge = coreCollectionFee + urgentPremium + distancePremium;
  const surgeBonus = baseBeforeSurge * (surgeMultiplier - 1.0);
  
  // Component 5: Tips (assume 10% of total bill, or extract if available)
  // For now, we'll use a fixed percentage
  const tipsAmount = totalBill * 0.10;
  
  // Component 6: Recyclables Bonus (estimate based on bag type and count)
  // Simplified: GHS 2 per bag for recyclable content
  const recyclablesBonus = bagsCollected * 2.0;
  
  // Component 7: Loyalty Cashback (5% of collector's share, platform funded)
  // Calculate after determining collector share
  
  // Calculate shares
  const platformShareRate = 0.20; // 20% platform fee
  
  // Platform takes 20% of operational components
  const operationalTotal = coreCollectionFee + urgentPremium + distancePremium + surgeBonus;
  const platformShareOperational = operationalTotal * platformShareRate;
  
  // Tips: 100% to collector
  const platformShareTips = 0;
  const collectorShareTips = tipsAmount;
  
  // Recyclables: 90% to collector, 10% to platform
  const platformShareRecyclables = recyclablesBonus * 0.10;
  const collectorShareRecyclables = recyclablesBonus * 0.90;
  
  // Collector's operational share (after platform fee)
  const collectorShareOperational = operationalTotal - platformShareOperational;
  
  // Loyalty cashback (5% of collector's operational + recyclables share, platform funded)
  const loyaltyCashback = (collectorShareOperational + collectorShareRecyclables) * 0.05;
  
  // Total shares
  const collectorTotalPayout = 
    collectorShareOperational + 
    collectorShareTips + 
    collectorShareRecyclables + 
    loyaltyCashback;
  
  const platformTotalShare = 
    platformShareOperational + 
    platformShareTips + 
    platformShareRecyclables;
  
  // Breakdown for storage
  const breakdown = {
    // Collector components
    collector_core_payout: coreCollectionFee - (coreCollectionFee * platformShareRate),
    collector_urgent_payout: urgentPremium - (urgentPremium * platformShareRate),
    collector_distance_payout: distancePremium - (distancePremium * platformShareRate),
    collector_surge_payout: surgeBonus - (surgeBonus * platformShareRate),
    collector_tips: collectorShareTips,
    collector_recyclables_payout: collectorShareRecyclables,
    collector_loyalty_cashback: loyaltyCashback,
    collector_total_payout: collectorTotalPayout,
    
    // Platform share
    platform_share: platformTotalShare,
    
    // Metadata
    surge_multiplier: surgeMultiplier,
    deadhead_km: deadheadKm,
    
    // Summary
    total_bill: totalBill,
    bags_collected: bagsCollected,
    is_urgent: isUrgent
  };
  
  logger.info('Payment sharing calculated:', {
    binId: digitalBin.id,
    totalBill,
    collectorPayout: collectorTotalPayout,
    platformShare: platformTotalShare,
    sharingRate: `${(platformTotalShare / totalBill * 100).toFixed(1)}%`
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
    
    // 6. Calculate payment sharing using the algorithm
    const payoutBreakdown = calculatePaymentSharing(digitalBin, payment);
    
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
