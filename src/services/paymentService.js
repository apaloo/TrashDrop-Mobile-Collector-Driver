import { supabase } from './supabase';
import { logger } from '../utils/logger';
import * as TrendiPayService from './trendiPayService';
import { computeBinPaymentShares } from '../utils/paymentCalculations';

/**
 * Payment Service
 * 
 * Handles client collections and collector disbursements via TrendiPay gateway.
 * 
 * Phase 4: Real TrendiPay integration enabled
 */

// Feature flag for TrendiPay integration
const ENABLE_TRENDIPAY = import.meta.env.VITE_ENABLE_TRENDIPAY === 'true';

console.log('💰 [PaymentService] Loaded. ENABLE_TRENDIPAY:', ENABLE_TRENDIPAY, '(raw env:', import.meta.env.VITE_ENABLE_TRENDIPAY, ')');

/**
 * Initiate client collection payment
 * 
 * @param {Object} paymentData - Payment details
 * @param {string} paymentData.digitalBinId - Digital bin UUID
 * @param {string} paymentData.collectorId - Collector profile UUID
 * @param {number} paymentData.binsCollected - Number of bins collected
 * @param {number} paymentData.totalBill - Amount in GHS
 * @param {string} paymentData.paymentMode - 'momo' | 'e_cash' | 'cash'
 * @param {string} paymentData.clientMomo - Client phone number (for MoMo/e-cash)
 * @param {string} paymentData.clientRSwitch - Network ('mtn' | 'vodafone' | 'airteltigo')
 * 
 * @returns {Promise<Object>} { success, paymentId, status, message }
 */
export async function initiateCollection(paymentData) {
  try {
    console.log('💰 [PaymentService] === INITIATE COLLECTION ===');
    console.log('💰 [PaymentService] Input paymentData:', JSON.stringify(paymentData, null, 2));
    console.log('💰 [PaymentService] ENABLE_TRENDIPAY:', ENABLE_TRENDIPAY);

    // Validate required fields
    if (!paymentData.digitalBinId || !paymentData.collectorId) {
      console.error('❌ [PaymentService] Missing IDs:', { digitalBinId: paymentData.digitalBinId, collectorId: paymentData.collectorId });
      throw new Error('Missing required IDs');
    }

    if (!paymentData.totalBill || paymentData.totalBill <= 0) {
      console.error('❌ [PaymentService] Invalid amount:', paymentData.totalBill);
      throw new Error('Invalid amount');
    }

    if (!['momo', 'e_cash', 'cash'].includes(paymentData.paymentMode)) {
      console.error('❌ [PaymentService] Invalid payment mode:', paymentData.paymentMode);
      throw new Error('Invalid payment mode');
    }

    // For MoMo/e-cash, validate phone number
    if ((paymentData.paymentMode === 'momo' || paymentData.paymentMode === 'e_cash') && !paymentData.clientMomo) {
      console.error('❌ [PaymentService] MoMo number missing for mode:', paymentData.paymentMode);
      throw new Error('Client MoMo number required');
    }

    // Fetch digital bin metadata to compute authoritative shares at collection time.
    // Storing the shares locks in the payout the collector was promised at this moment,
    // so future formula changes won't retroactively alter past payouts.
    let binMetadata = { is_urgent: false, deadhead_km: 0 };
    const { data: binData, error: binFetchError } = await supabase
      .from('digital_bins')
      .select('is_urgent, deadhead_km')
      .eq('id', paymentData.digitalBinId)
      .maybeSingle();

    if (binFetchError) {
      logger.warn('[PaymentService] Could not fetch bin metadata, using defaults:', binFetchError.message);
    } else if (binData) {
      binMetadata = binData;
    }

    const { collectorShare, platformShare } = computeBinPaymentShares({
      totalBill: paymentData.totalBill,
      isUrgent: binMetadata.is_urgent || false,
      deadheadKm: parseFloat(binMetadata.deadhead_km) || 0,
      requestFee: 1.0
    });

    console.log('💰 [PaymentService] Computed shares:', {
      totalBill: paymentData.totalBill,
      collectorShare,
      platformShare,
      isUrgent: binMetadata.is_urgent,
      deadheadKm: binMetadata.deadhead_km
    });

    // Create bin_payments record
    const paymentRecord = {
      digital_bin_id: paymentData.digitalBinId,
      collector_id: paymentData.collectorId,
      bags_collected: paymentData.binsCollected || paymentData.bagsCollected || 1,
      scanned_bag_ids: paymentData.scannedBinIds || paymentData.scannedBagIds || [],
      total_bill: paymentData.totalBill,
      collector_share: collectorShare,
      platform_share: platformShare,
      payment_mode: paymentData.paymentMode,
      client_momo: paymentData.clientMomo || null,
      client_rswitch: paymentData.clientRSwitch || null,
      type: 'collection',
      currency: 'GHS',
      status: 'pending'
    };

    console.log('💰 [PaymentService] Inserting bin_payments record:', JSON.stringify(paymentRecord, null, 2));

    const { data, error } = await supabase
      .from('bin_payments')
      .insert([paymentRecord])
      .select()
      .single();

    if (error) {
      console.error('❌ [PaymentService] DB insert failed:', { code: error.code, message: error.message, details: error.details, hint: error.hint });
      throw new Error(`Database error: ${error.message}`);
    }

    console.log('✅ [PaymentService] Payment record created:', { id: data.id, status: data.status });

    // Handle cash vs MoMo/e-cash
    console.log('💰 [PaymentService] Payment mode:', paymentData.paymentMode);
    
    if (paymentData.paymentMode === 'cash') {
      console.log('💰 [PaymentService] Cash payment — marking as success immediately');
      // Cash payment - immediate success
      const { error: updateError } = await supabase
        .from('bin_payments')
        .update({ status: 'success' })
        .eq('id', data.id);

      if (updateError) {
        console.error('❌ [PaymentService] Error updating cash payment:', updateError);
      }

      return {
        success: true,
        paymentId: data.id,
        status: 'success',
        message: 'Cash payment recorded successfully'
      };
    } else {
      // MoMo/e-cash - Call TrendiPay API
      if (ENABLE_TRENDIPAY) {
        console.log('💰 [PaymentService] TrendiPay ENABLED — calling gateway...');
        
        const gatewayParams = {
          reference: data.id,
          accountNumber: paymentData.clientMomo,
          rSwitch: paymentData.clientRSwitch,
          amount: paymentData.totalBill,
          description: `Digital bin ${paymentData.digitalBinId.substring(0, 8)}`,
          currency: 'GHS'
        };
        console.log('💰 [PaymentService] Gateway params:', JSON.stringify(gatewayParams, null, 2));
        
        const gatewayResult = await TrendiPayService.initiateCollection(gatewayParams);

        console.log('💰 [PaymentService] Gateway result:', JSON.stringify(gatewayResult, null, 2));

        if (!gatewayResult.success) {
          console.error('❌ [PaymentService] Gateway failed, updating DB with error...');
          // Update payment record with error
          const { error: failError } = await supabase
            .from('bin_payments')
            .update({ 
              status: 'failed',
              gateway_error: gatewayResult.error
            })
            .eq('id', data.id);

          if (failError) {
            console.error('❌ [PaymentService] Failed to update payment as failed:', failError);
          }

          throw new Error(gatewayResult.error || 'Payment gateway error');
        }

        // Update payment record with gateway details
        console.log('💰 [PaymentService] Updating DB with gateway details...');
        const updatePayload = { 
          status: gatewayResult.status,
          gateway_reference: gatewayResult.gatewayReference,
          gateway_transaction_id: gatewayResult.transactionId
        };
        console.log('💰 [PaymentService] DB update payload:', updatePayload);
        
        const { error: updateError } = await supabase
          .from('bin_payments')
          .update(updatePayload)
          .eq('id', data.id);

        if (updateError) {
          console.warn('⚠️ [PaymentService] Failed to update gateway reference:', { code: updateError.code, message: updateError.message, details: updateError.details });
        } else {
          console.log('✅ [PaymentService] DB updated with gateway details');
        }

        const finalResult = {
          success: true,
          paymentId: data.id,
          status: gatewayResult.status,
          message: gatewayResult.message || 'Payment initiated. Awaiting client approval.',
          transactionId: gatewayResult.transactionId,
          authorizationSteps: gatewayResult.authorizationSteps // MoMo approval steps for user
        };
        console.log('✅ [PaymentService] Returning to caller:', JSON.stringify(finalResult, null, 2));

        return finalResult;
      } else {
        console.warn('⚠️ [PaymentService] TrendiPay DISABLED — using stub mode');
        
        return {
          success: true,
          paymentId: data.id,
          status: 'pending',
          message: 'Payment initiated (stub mode). Use simulatePaymentSuccess() for testing.'
        };
      }
    }

  } catch (error) {
    console.error('❌ [PaymentService] Collection error:', error.message, error);
    return {
      success: false,
      error: error.message || 'Failed to initiate payment'
    };
  }
}

/**
 * Check payment status
 * 
 * @param {string} paymentId - Payment record UUID
 * @returns {Promise<Object>} Payment status details
 */
export async function checkPaymentStatus(paymentId) {
  try {
    console.log('🔍 [PaymentService] Checking status for paymentId:', paymentId);
    
    const { data, error } = await supabase
      .from('bin_payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (error) {
      console.error('❌ [PaymentService] Status check DB error:', { code: error.code, message: error.message });
      throw new Error(`Database error: ${error.message}`);
    }

    console.log('🔍 [PaymentService] Payment status:', { id: data.id, status: data.status, gateway_error: data.gateway_error, gateway_transaction_id: data.gateway_transaction_id });

    return {
      success: true,
      status: data.status,
      payment: data
    };

  } catch (error) {
    console.error('❌ [PaymentService] checkPaymentStatus error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Check TrendiPay collection status directly
 * 
 * @param {string} transactionId - TrendiPay transaction ID
 * @param {string} reference - Original payment reference
 * @returns {Promise<Object>} TrendiPay status
 */
export async function checkCollectionStatus(transactionId, reference) {
  try {
    if (!ENABLE_TRENDIPAY) {
      return {
        success: false,
        error: 'TrendiPay is not enabled'
      };
    }

    logger.info('Checking TrendiPay collection status:', { transactionId, reference });
    
    const result = await TrendiPayService.checkCollectionStatus(transactionId, reference);
    
    logger.info('TrendiPay status result:', result);
    
    return result;

  } catch (error) {
    logger.error('Error checking collection status:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Simulate client payment approval (Phase 1 testing only)
 * Remove this in Phase 4 when real webhooks are implemented
 */
export async function simulatePaymentSuccess(paymentId) {
  try {
    const { error } = await supabase
      .from('bin_payments')
      .update({ 
        status: 'success',
        gateway_reference: `sim_${Date.now()}`
      })
      .eq('id', paymentId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    logger.error('Error simulating payment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Initialize disbursement (called from earnings cashout)
 * Phase 1: Not implemented yet (Phase 4)
 */
export async function initiateDisbursement(collectorId, amount) {
  logger.warn('Phase 1: Disbursement not yet implemented');
  
  // TODO Phase 4: Implement TrendiPay disbursement
  return {
    success: false,
    error: 'Disbursement feature coming soon'
  };
}
