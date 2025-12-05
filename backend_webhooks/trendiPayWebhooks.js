/**
 * TrendiPay Webhook Handlers (Backend)
 * 
 * These handlers should be implemented in your backend API server.
 * This file serves as a reference/template for backend implementation.
 * 
 * Routes to implement:
 * - POST /api/webhooks/trendipay/collection
 * - POST /api/webhooks/trendipay/disbursement
 * 
 * Framework: Express.js (adapt for your framework)
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Lazy-load Supabase client (initialized after env vars are loaded)
let supabase = null;

function getSupabaseClient() {
  if (!supabase) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role for webhooks
    );
  }
  return supabase;
}

/**
 * Verify TrendiPay webhook signature
 */
function verifySignature(signature, payload, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return signature === expectedSignature;
}

/**
 * Webhook Handler: Collection (Client Payment)
 * 
 * Called by TrendiPay when client approves/rejects payment
 * 
 * Route: POST /api/webhooks/trendipay/collection
 */
export async function handleCollectionWebhook(req, res) {
  try {
    console.log('📥 TrendiPay Collection Webhook received');
    
    // 1. Verify signature (security)
    const signature = req.headers['x-trendipay-signature'];
    const payload = req.body;
    
    if (!verifySignature(signature, payload, process.env.TRENDIPAY_WEBHOOK_SECRET)) {
      console.error('❌ Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // 2. Extract webhook data
    const {
      reference,        // Our bin_payments.id
      transactionId,    // TrendiPay transaction ID
      status,           // 'success', 'failed', 'expired'
      amount,
      accountNumber,
      message,
      timestamp
    } = payload;
    
    console.log('Webhook data:', {
      reference,
      transactionId,
      status,
      amount
    });
    
    // 3. Update bin_payments record
    const { data: payment, error: fetchError } = await getSupabaseClient()
      .from('bin_payments')
      .select('*')
      .eq('id', reference)
      .single();
    
    if (fetchError || !payment) {
      console.error('Payment record not found:', reference);
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    // 4. Map TrendiPay status to our system
    let systemStatus;
    switch(status) {
      case 'successful':
      case 'success':
        systemStatus = 'success';
        break;
      case 'failed':
      case 'declined':
        systemStatus = 'failed';
        break;
      case 'pending':
      case 'processing':
        systemStatus = 'initiated';
        break;
      default:
        systemStatus = 'failed';
    }
    
    // 5. Update status based on webhook
    const updateData = {
      status: systemStatus,
      gateway_reference: transactionId,
      raw_gateway_response: payload, // Store full webhook payload
      updated_at: new Date().toISOString()
    };
    
    if (systemStatus === 'failed') {
      updateData.gateway_error = message || `Payment ${status}`;
    }
    
    const { data: updatedPayment, error: updateError } = await getSupabaseClient()
      .from('bin_payments')
      .update(updateData)
      .eq('id', reference)
      .select()
      .single();
    
    if (updateError) {
      console.error('Failed to update payment:', updateError);
      return res.status(500).json({ error: 'Database update failed' });
    }
    
    console.log(`✅ Collection payment ${reference} updated to: ${systemStatus}`);
    
    // 6. Update digital_bin status if payment successful
    if (systemStatus === 'success' && updatedPayment) {
      const { error: binError } = await getSupabaseClient()
        .from('digital_bins')
        .update({ 
          status: 'picked_up',
          collected_at: new Date().toISOString()
        })
        .eq('id', payment.digital_bin_id);
      
      if (binError) {
        console.error('Failed to update digital_bin status:', binError);
      } else {
        console.log('✅ Digital bin marked as picked_up');
      }
    }
    
    // 7. Optional: Send notification to collector (success/failure)
    if (systemStatus === 'success') {
      // TODO: Send push notification or email to collector
      console.log('💰 Payment successful - notify collector');
    } else if (systemStatus === 'failed') {
      console.log('⚠️ Payment failed - notify collector to retry');
    }
    
    // 8. Acknowledge webhook
    return res.status(200).json({
      success: true,
      message: 'Webhook processed',
      reference,
      status: systemStatus,
      originalStatus: status
    });
    
  } catch (error) {
    console.error('Error processing collection webhook:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Webhook Handler: Disbursement (Collector Payout)
 * 
 * Called by TrendiPay when disbursement completes/fails
 * 
 * Route: POST /api/webhooks/trendipay/disbursement
 */
export async function handleDisbursementWebhook(req, res) {
  try {
    console.log('📤 TrendiPay Disbursement Webhook received');
    
    // 1. Verify signature
    const signature = req.headers['x-trendipay-signature'];
    const payload = req.body;
    
    if (!verifySignature(signature, payload, process.env.TRENDIPAY_WEBHOOK_SECRET)) {
      console.error('❌ Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // 2. Extract webhook data
    const {
      reference,        // Our bin_payments.id (disbursement)
      transactionId,    // TrendiPay transaction ID
      status,           // 'success', 'failed', 'processing'
      amount,
      accountNumber,
      message,
      timestamp
    } = payload;
    
    console.log('Webhook data:', {
      reference,
      transactionId,
      status,
      amount
    });
    
    // 3. Update bin_payments disbursement record
    const { data: disbursement, error: fetchError } = await getSupabaseClient()
      .from('bin_payments')
      .select('*')
      .eq('id', reference)
      .eq('type', 'disbursement')
      .single();
    
    if (fetchError || !disbursement) {
      console.error('Disbursement record not found:', reference);
      return res.status(404).json({ error: 'Disbursement not found' });
    }
    
    // 4. Map TrendiPay status to our system
    let systemStatus;
    switch(status) {
      case 'successful':
      case 'success':
        systemStatus = 'success';
        break;
      case 'failed':
      case 'declined':
        systemStatus = 'failed';
        break;
      case 'pending':
      case 'processing':
        systemStatus = 'initiated';
        break;
      default:
        systemStatus = 'failed';
    }
    
    // 5. Update status
    const updateData = {
      status: systemStatus,
      gateway_reference: transactionId,
      raw_gateway_response: payload, // Store full webhook payload
      updated_at: new Date().toISOString()
    };
    
    if (systemStatus === 'failed') {
      updateData.gateway_error = message || 'Disbursement failed';
    }
    
    const { error: updateError } = await getSupabaseClient()
      .from('bin_payments')
      .update(updateData)
      .eq('id', reference);
    
    if (updateError) {
      console.error('Failed to update disbursement:', updateError);
      return res.status(500).json({ error: 'Database update failed' });
    }
    
    console.log(`✅ Disbursement ${reference} updated to: ${systemStatus}`);
    
    // 6. Optional: Send notification to collector
    if (systemStatus === 'success') {
      // TODO: Send push notification - "Your payout of GHS X.XX has been sent!"
      console.log(`💸 Disbursement successful - GHS ${amount} sent to ${accountNumber}`);
    } else if (systemStatus === 'failed') {
      // TODO: Send alert - "Payout failed - contact support"
      console.log('⚠️ Disbursement failed - notify collector');
    }
    
    // 7. Acknowledge webhook
    return res.status(200).json({
      success: true,
      message: 'Webhook processed',
      reference,
      status: systemStatus,
      originalStatus: status
    });
    
  } catch (error) {
    console.error('Error processing disbursement webhook:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Express.js Route Setup Example
 */
export function setupTrendiPayRoutes(app) {
  // Collection webhook
  app.post('/api/webhooks/trendipay/collection', handleCollectionWebhook);
  
  // Disbursement webhook
  app.post('/api/webhooks/trendipay/disbursement', handleDisbursementWebhook);
  
  console.log('✅ TrendiPay webhook routes registered');
}

/**
 * Usage in your Express app:
 * 
 * import express from 'express';
 * import { setupTrendiPayRoutes } from './webhooks/trendiPayWebhooks.js';
 * 
 * const app = express();
 * app.use(express.json());
 * 
 * setupTrendiPayRoutes(app);
 * 
 * app.listen(3000, () => {
 *   console.log('Server running on port 3000');
 * });
 */

/**
 * Testing Webhooks Locally:
 * 
 * 1. Use ngrok to expose localhost:
 *    ngrok http 3000
 * 
 * 2. Configure TrendiPay dashboard:
 *    Collection callback: https://your-ngrok-url.ngrok.io/api/webhooks/trendipay/collection
 *    Disbursement callback: https://your-ngrok-url.ngrok.io/api/webhooks/trendipay/disbursement
 * 
 * 3. Monitor webhook logs:
 *    tail -f server.log
 * 
 * 4. Test with curl:
 *    curl -X POST http://localhost:3000/api/webhooks/trendipay/collection \
 *      -H "Content-Type: application/json" \
 *      -H "X-TrendiPay-Signature: test-signature" \
 *      -d '{
 *        "reference": "payment-id-uuid",
 *        "transactionId": "TP123456",
 *        "status": "success",
 *        "amount": 50.00
 *      }'
 */
