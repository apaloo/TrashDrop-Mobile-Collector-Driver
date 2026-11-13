import { supabase } from './supabase';
import { logger } from '../utils/logger';
import { computeBinPaymentShares, promotionalPayout } from '../utils/paymentCalculations';
import { finalizePickupPayout } from './bagPricing';

/**
 * Disposal Service
 * 
 * Marks digital bins and pickup requests disposed, and tells the collector
 * what the job earned: the database's own figure (it decides what is paid)
 */

/**
 * What the collector earns from a digital bin is set by the database
 * (docs/COLLECTOR_PAYOUTS.md in the household repository): a promotional
 * bin pays its booked promotional payout; a standard bin pays 85–92% of the
 * base by travel distance plus 75% of any urgent surcharge. There is no
 * loyalty cashback, distance bonus or surge share (owner, 2026-11-13).
 */

/**
 * Calculate payment sharing based on bin data and payment record
 * The figure the collector is shown at disposal: the same as the database's
 * (td_bin_collector_share), plus confirmed tips.
 * 
 * @param {Object} digitalBin - Digital bin data from database
 * @param {Object} payment - Payment record from bin_payments
 * @param {number} actualTips - Actual tips from collector_tips table (default 0)
 * @returns {Object} Payout breakdown
 */
function calculatePaymentSharing(digitalBin, payment, actualTips = 0) {
  logger.info('Calculating payment sharing for bin:', digitalBin.id);

  // ════════════════════════════════════════════════════════════════════
  // PROMOTIONAL BIN — fixed payout, bypass SOP v4.5.6 entirely
  // ════════════════════════════════════════════════════════════════════
  if (digitalBin.is_promotional) {
    const binSize = parseInt(digitalBin.bin_size_liters) || 120;
    // The payout booked with the bin (promotional rate × bags); see promotionalPayout
    const schedule = promotionalPayout({
      binSizeLiters: binSize,
      bagCount: digitalBin.bag_count,
      storedPayout: digitalBin.collector_core_payout,
      storedFee: digitalBin.fee,
    });
    const clientFee = parseFloat(payment.total_bill) || parseFloat(digitalBin.fee) || schedule.clientFee;

    logger.info('🎁 Promotional payout for bin:', {
      binId: digitalBin.id,
      binSize,
      clientFee,
      collectorPayout: schedule.collectorPayout,
      platformSubsidy: schedule.platformSubsidy
    });

    return {
      collector_core_payout: schedule.collectorPayout,
      collector_urgent_payout: 0,
      collector_distance_payout: 0,
      collector_surge_payout: 0,
      collector_tips: actualTips,
      collector_recyclables_payout: 0,
      collector_loyalty_cashback: 0,
      collector_total_payout: schedule.collectorPayout + actualTips,
      platform_share: Math.max(0, clientFee - schedule.collectorPayout),
      platform_subsidy: Math.max(0, schedule.collectorPayout - clientFee),
      platform_core_margin: 0,
      platform_urgent_share: 0,
      platform_surge_share: 0,
      platform_recyclables_share: 0,
      user_recyclables_credit: 0,
      surge_multiplier: 1.0,
      deadhead_km: parseFloat(digitalBin.deadhead_km) || 0,
      deadhead_share: 1.0,
      loyalty_rate: 0,
      payout_from_fee: schedule.collectorPayout,
      platform_request_fee: 0,
      total_bill: clientFee,
      shareable_amount: clientFee,
      bags_collected: parseInt(digitalBin.bags_collected) || parseInt(payment.bags_collected) || 1,
      is_urgent: false,
      is_promotional: true,
      base_portion: clientFee,
      urgent_portion: 0
    };
  }
  
  // ════════════════════════════════════════════════════════════════════
  // STANDARD BIN — the database's own figure (owner-approved 2026-11-13).
  // The database works the collector's share out when the payment is
  // recorded (td_bin_collector_share): the amount paid, capped at the bin's
  // fee, minus the GH₵1 request fee; 85–92% of the base by travel distance
  // (87% when unknown) plus 75% of any urgent surcharge; never above the
  // booked payout (docs/COLLECTOR_PAYOUTS.md in the household repository).
  // This shows the collector that figure. It used to add a 1% loyalty
  // cashback, a distance bonus and a surge share that nothing pays.
  // ════════════════════════════════════════════════════════════════════
  const fee = parseFloat(digitalBin.fee) || 0;
  const paid = parseFloat(payment.total_bill) || fee || parseFloat(digitalBin.payout) || 0;
  const totalBill = Math.min(paid, fee); // the database never counts more than the fee
  const isUrgent = digitalBin.is_urgent || false;
  const deadheadKm = parseFloat(digitalBin.deadhead_km) || 0;
  const shares = computeBinPaymentShares({ totalBill, isUrgent, deadheadKm });
  const booked = parseFloat(digitalBin.collector_total_payout);
  const payoutFromFee = booked > 0 ? Math.min(shares.collectorShare, booked) : shares.collectorShare;
  const { basePortion, urgentPortion, deadheadShare, requestFee } = shares.breakdown;
  const collectorUrgentPayout = Math.min(Number((urgentPortion * 0.75).toFixed(2)), payoutFromFee);
  const collectorCorePayout = Number((payoutFromFee - collectorUrgentPayout).toFixed(2));

  const breakdown = {
    collector_core_payout: collectorCorePayout,
    collector_urgent_payout: collectorUrgentPayout,
    collector_distance_payout: 0,
    collector_surge_payout: 0,
    collector_tips: actualTips,
    collector_recyclables_payout: 0,
    collector_loyalty_cashback: 0,
    collector_total_payout: Number((payoutFromFee + actualTips).toFixed(2)),
    platform_share: Number((totalBill - payoutFromFee).toFixed(2)),
    platform_core_margin: Number((basePortion - collectorCorePayout).toFixed(2)),
    platform_urgent_share: Number((urgentPortion - collectorUrgentPayout).toFixed(2)),
    platform_surge_share: 0,
    platform_recyclables_share: 0,
    user_recyclables_credit: 0,
    surge_multiplier: 1.0,
    deadhead_km: deadheadKm,
    deadhead_share: deadheadShare,
    loyalty_rate: 0,
    payout_from_fee: payoutFromFee,
    platform_request_fee: requestFee,
    total_bill: totalBill,
    shareable_amount: shares.breakdown.shareableAmount,
    bags_collected: parseInt(digitalBin.bags_collected) || parseInt(payment.bags_collected) || 1,
    is_urgent: isUrgent,
    base_portion: basePortion,
    urgent_portion: urgentPortion
  };

  logger.info('💰 Payout shown at disposal (the database\'s figure):', {
    binId: digitalBin.id, totalBill, collectorShare: payoutFromFee, tips: actualTips, isUrgent, deadheadKm,
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
export async function disposeDigitalBin(binId, collectorId, disposalSiteId = null, disposalSiteName = null) {
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
    
    // 2. Verify bin is in collecting status
    if (digitalBin.status !== 'collecting') {
      throw new Error(`Bin must be in 'collecting' status. Current status: ${digitalBin.status}`);
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
    
    // No payment record, or it could not be read: the bin is treated as
    // unconfirmed (GH₵0 shown below; the database decides what is owed), never
    // as paid. Disposal at the site still goes ahead (TD52).
    if (paymentError) {
      logger.error('Could not read the payment record for bin disposal; treating it as unconfirmed:', { binId, message: paymentError.message });
    }
    let paymentData = paymentError ? null : payment;
    const noPaymentRecord = !paymentData;
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
        status: 'unconfirmed',
        created_at: digitalBin.created_at
      };
    }
    
    // 5. Payment not confirmed (MoMo/e-cash): disposal is never blocked at the
    // site. Owner's decisions 2026-11-12: a payment still pending (or
    // initiated) shows the expected payout marked "pending"; a failed payment
    // shows GH₵0 and "payment failed". What is withdrawable is decided by the
    // database (td_withdrawable_items), not by these figures.
    const nonCash = paymentData.payment_mode !== 'cash';
    const paymentPending = nonCash && ['pending', 'initiated'].includes(paymentData.status);
    const paymentFailed = nonCash && paymentData.status === 'failed';
    if (paymentData.payment_mode !== 'cash' && paymentData.status !== 'success') {
      logger.warn('⚠️ Payment not confirmed at disposal:', {
        binId,
        paymentId: paymentData.id,
        status: paymentData.status,
        mode: paymentData.payment_mode
      });
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
    let payoutBreakdown = calculatePaymentSharing(digitalBin, paymentData, actualTips);
    if (noPaymentRecord || paymentFailed) {
      // Nothing was (or could be) collected from the client: show nothing earned
      payoutBreakdown = Object.fromEntries(Object.entries(payoutBreakdown)
        .map(([key, amount]) => [key, key.startsWith('collector_') ? 0 : amount]));
    }
    
    // 7. Update digital_bins with disposal info and payout breakdown
    const { error: updateError } = await supabase
      .from('digital_bins')
      .update({
        status: 'disposed',
        disposed_at: new Date().toISOString(),
        disposal_site_id: disposalSiteId,
        // No payout figures: the database keeps the booked payout and works
        // out the share itself, so anything sent here would be ignored
        updated_at: new Date().toISOString()
      })
      .eq('id', binId)
      .eq('collector_id', collectorId); // Extra safety
    
    if (updateError) {
      logger.error('Error updating bin with disposal info:', updateError);
      throw new Error(`Failed to update bin: ${updateError.message}`);
    }
    
    await notifyUserOfDisposal('digital_bins', binId, disposalSiteName);

    logger.info('✅ Digital bin disposed successfully:', {
      binId,
      collectorPayout: payoutBreakdown.collector_total_payout,
      platformShare: payoutBreakdown.platform_share
    });
    
    return {
      success: true,
      binId,
      payoutBreakdown,
      paymentPending,
      paymentFailed,
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
 * Dispose a regular pickup request
 * 
 * Pickup requests are prepaid: the household bought the bags and each bag's
 * unit_price includes the pickup. The collector earns 100% of the unit prices
 * of the bags scanned for the request, plus tips, with no request fee taken
 * off. The database works the payout out (finalize_pickup_request_payout) and
 * stores it on the request; this function only marks the request disposed.
 * 
 * @param {string} requestId - Pickup request UUID
 * @param {string} collectorId - Collector user UUID
 * @param {Object} disposalSiteInfo - { id, name, address } of the disposal center
 * @returns {Promise<Object>} Result with success status and payout info
 */
export async function disposePickupRequest(requestId, collectorId, disposalSiteInfo = {}) {
  try {
    logger.info('Starting disposal process for pickup request:', requestId);

    // 1. Fetch the pickup request
    const { data: request, error: reqError } = await supabase
      .from('pickup_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (reqError || !request) {
      throw new Error(`Pickup request not found: ${reqError?.message || 'Unknown error'}`);
    }

    // 2. Verify request is in a disposable status
    if (!['collecting', 'picked_up'].includes(request.status)) {
      throw new Error(`Request must be in 'collecting' or 'picked_up' status. Current: ${request.status}`);
    }

    // 3. Verify collector ownership
    if (request.collector_id !== collectorId) {
      throw new Error('This request is assigned to a different collector');
    }

    // 4. Payout: 100% of the scanned bags' unit prices + confirmed tips,
    //    calculated and stored by the database
    const payout = await finalizePickupPayout(requestId);
    const payoutBreakdown = {
      ...payout,
      collector_core_payout: Number(payout?.bag_total) || 0,
      collector_tips: Number(payout?.tips) || 0,
      collector_total_payout: Number(payout?.total) || 0,
      platform_share: 0
    };

    // 5. Build disposal site string
    const disposalSite = disposalSiteInfo.name
      ? `${disposalSiteInfo.name}${disposalSiteInfo.address ? ', ' + disposalSiteInfo.address : ''}`
      : 'Disposal Center';
    const disposalTimestamp = new Date().toISOString();

    // 6. Mark disposed (the payout is already stored on the request)
    const { error: updateError } = await supabase
      .from('pickup_requests')
      .update({
        status: 'disposed',
        disposal_site: disposalSite,
        disposal_timestamp: disposalTimestamp,
        disposed_at: disposalTimestamp,
        updated_at: disposalTimestamp
      })
      .eq('id', requestId)
      .eq('collector_id', collectorId);

    if (updateError) {
      logger.error('Error updating pickup request with disposal info:', updateError);
      throw new Error(`Failed to update request: ${updateError.message}`);
    }

    await notifyUserOfDisposal('pickup_requests', requestId, disposalSiteInfo.name);

    logger.info('✅ Pickup request disposed successfully:', {
      requestId,
      payoutModel: payout?.model,
      bagsScanned: payout?.bags_scanned,
      collectorPayout: payoutBreakdown.collector_total_payout,
      platformShare: payoutBreakdown.platform_share
    });

    return {
      success: true,
      requestId,
      payoutBreakdown,
      message: 'Pickup request disposed successfully'
    };

  } catch (error) {
    logger.error('Error disposing pickup request:', error);
    return {
      success: false,
      error: error.message || 'Failed to dispose pickup request'
    };
  }
}

/**
 * Tell the user their waste has been disposed of (the last step of a pickup).
 * Never throws: a failed notification must not undo or block a disposal.
 *
 * @param {string} table - 'pickup_requests' or 'digital_bins'
 * @param {string} jobId - Pickup request or digital bin UUID
 * @param {string|null} siteName - Disposal site name, if known
 */
export async function notifyUserOfDisposal(table, jobId, siteName = null) {
  try {
    const { data: job } = await supabase
      .from(table)
      .select('user_id, waste_type')
      .eq('id', jobId)
      .single();

    if (!job?.user_id) return;

    const where = siteName ? ` at ${siteName}` : '';
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: job.user_id,
        title: 'Waste Disposed ♻️',
        message: `Your ${job.waste_type || 'waste'} has been disposed of${where}. Thank you for using TrashDrop!`,
        type: 'pickup_disposed',
        read: false
      });

    if (error) {
      logger.warn('Could not notify user of disposal:', error.message);
    }
  } catch (error) {
    logger.warn('Could not notify user of disposal:', error);
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
