import { supabase } from './supabase';
import { logger } from '../utils/logger';
import * as TrendiPayService from './trendiPayService';

/**
 * Payment Service
 * 
 * Handles client collections and collector disbursements via TrendiPay gateway.
 * 
 * Phase 4: Real TrendiPay integration enabled
 */

// Feature flag for TrendiPay integration
const ENABLE_TRENDIPAY = import.meta.env.VITE_ENABLE_TRENDIPAY === 'true';

/**
 * Initiate client collection payment
 * 
 * @param {Object} paymentData - Payment details
 * @param {string} paymentData.digitalBinId - Digital bin UUID
 * @param {string} paymentData.collectorId - Collector profile UUID
 * @param {number} paymentData.bagsCollected - Number of bags
 * @param {number} paymentData.totalBill - Amount in GHS
 * @param {string} paymentData.paymentMode - 'momo' | 'e_cash' | 'cash'
 * @param {string} paymentData.clientMomo - Client phone number (for MoMo/e-cash)
 * @param {string} paymentData.clientRSwitch - Network ('mtn' | 'vodafone' | 'airteltigo')
 * 
 * @returns {Promise<Object>} { success, paymentId, status, message }
 */
export async function initiateCollection(paymentData) {
  try {
    logger.info('Initiating collection payment:', {
      digitalBinId: paymentData.digitalBinId,
      amount: paymentData.totalBill,
      mode: paymentData.paymentMode
    });

    // Validate required fields
    if (!paymentData.digitalBinId || !paymentData.collectorId) {
      throw new Error('Missing required IDs');
    }

    if (!paymentData.totalBill || paymentData.totalBill <= 0) {
      throw new Error('Invalid amount');
    }

    if (!['momo', 'e_cash', 'cash'].includes(paymentData.paymentMode)) {
      throw new Error('Invalid payment mode');
    }

    // For MoMo/e-cash, validate phone number
    if ((paymentData.paymentMode === 'momo' || paymentData.paymentMode === 'e_cash') && !paymentData.clientMomo) {
      throw new Error('Client MoMo number required');
    }

    // Create bin_payments record
    const paymentRecord = {
      digital_bin_id: paymentData.digitalBinId,
      collector_id: paymentData.collectorId,
      bags_collected: paymentData.bagsCollected,
      total_bill: paymentData.totalBill,
      payment_mode: paymentData.paymentMode,
      client_momo: paymentData.clientMomo || null,
      client_rswitch: paymentData.clientRSwitch || null,
      type: 'collection',
      currency: 'GHS',
      status: 'pending'
    };

    const { data, error } = await supabase
      .from('bin_payments')
      .insert([paymentRecord])
      .select()
      .single();

    if (error) {
      logger.error('Error creating payment record:', error);
      throw new Error(`Database error: ${error.message}`);
    }

    logger.info('Payment record created:', data.id);

    // Handle cash vs MoMo/e-cash
    if (paymentData.paymentMode === 'cash') {
      // Cash payment - immediate success
      const { error: updateError } = await supabase
        .from('bin_payments')
        .update({ status: 'success' })
        .eq('id', data.id);

      if (updateError) {
        logger.error('Error updating cash payment:', updateError);
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
        logger.info('Calling TrendiPay collection API...');
        
        const gatewayResult = await TrendiPayService.initiateCollection({
          reference: data.id,
          accountNumber: paymentData.clientMomo,
          rSwitch: paymentData.clientRSwitch,
          amount: paymentData.totalBill,
          description: `Digital bin ${paymentData.digitalBinId.substring(0, 8)}`,
          currency: 'GHS'
        });

        if (!gatewayResult.success) {
          // Update payment record with error
          await supabase
            .from('bin_payments')
            .update({ 
              status: 'failed',
              gateway_error: gatewayResult.error
            })
            .eq('id', data.id);

          throw new Error(gatewayResult.error || 'Payment gateway error');
        }

        // Update payment record with gateway details
        const { error: updateError } = await supabase
          .from('bin_payments')
          .update({ 
            status: gatewayResult.status, // 'pending', 'processing', etc.
            gateway_reference: gatewayResult.gatewayReference,
            gateway_transaction_id: gatewayResult.transactionId
          })
          .eq('id', data.id);

        if (updateError) {
          logger.warn('Failed to update gateway reference:', updateError);
        }

        logger.info('TrendiPay collection initiated:', {
          paymentId: data.id,
          transactionId: gatewayResult.transactionId,
          status: gatewayResult.status
        });

        return {
          success: true,
          paymentId: data.id,
          status: gatewayResult.status,
          message: gatewayResult.message || 'Payment initiated. Awaiting client approval.',
          transactionId: gatewayResult.transactionId
        };
      } else {
        // Stub mode: Mark as pending for testing
        logger.warn('TrendiPay disabled - using stub mode');
        
        return {
          success: true,
          paymentId: data.id,
          status: 'pending',
          message: 'Payment initiated (stub mode). Use simulatePaymentSuccess() for testing.'
        };
      }
    }

  } catch (error) {
    logger.error('Error initiating collection:', error);
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
    const { data, error } = await supabase
      .from('bin_payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return {
      success: true,
      status: data.status,
      payment: data
    };

  } catch (error) {
    logger.error('Error checking payment status:', error);
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
