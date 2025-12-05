/**
 * Webhook Testing Script
 * 
 * Tests TrendiPay webhook handlers locally
 * Usage: node test-webhook.js
 */

import crypto from 'crypto';

const BASE_URL = 'http://localhost:3000';
const WEBHOOK_SECRET = process.env.TRENDIPAY_WEBHOOK_SECRET || 'test-secret';

/**
 * Generate HMAC signature for webhook payload
 */
function generateSignature(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}

/**
 * Send webhook request
 */
async function sendWebhook(endpoint, payload) {
  const signature = generateSignature(payload, WEBHOOK_SECRET);
  
  console.log(`\n📤 Sending webhook to ${endpoint}`);
  console.log('Payload:', JSON.stringify(payload, null, 2));
  console.log('Signature:', signature);
  
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TrendiPay-Signature': signature
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    console.log(`\n✅ Response (${response.status}):`, JSON.stringify(data, null, 2));
    return { success: response.ok, data };
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test collection webhook - successful payment
 */
async function testCollectionSuccess() {
  console.log('\n🧪 TEST 1: Collection Webhook - Successful Payment');
  console.log('═'.repeat(60));
  
  const payload = {
    reference: '550e8400-e29b-41d4-a716-446655440000', // Replace with actual bin_payments.id
    transactionId: 'TP' + Date.now(),
    status: 'successful',
    amount: 50.00,
    accountNumber: '0241234567',
    message: 'Payment successful',
    timestamp: new Date().toISOString()
  };
  
  return await sendWebhook('/api/webhooks/trendipay/collection', payload);
}

/**
 * Test collection webhook - failed payment
 */
async function testCollectionFailed() {
  console.log('\n🧪 TEST 2: Collection Webhook - Failed Payment');
  console.log('═'.repeat(60));
  
  const payload = {
    reference: '550e8400-e29b-41d4-a716-446655440000',
    transactionId: 'TP' + Date.now(),
    status: 'failed',
    amount: 50.00,
    accountNumber: '0241234567',
    message: 'Insufficient funds',
    timestamp: new Date().toISOString()
  };
  
  return await sendWebhook('/api/webhooks/trendipay/collection', payload);
}

/**
 * Test disbursement webhook - successful payout
 */
async function testDisbursementSuccess() {
  console.log('\n🧪 TEST 3: Disbursement Webhook - Successful Payout');
  console.log('═'.repeat(60));
  
  const payload = {
    reference: '660e8400-e29b-41d4-a716-446655440001', // Replace with actual disbursement bin_payments.id
    transactionId: 'TP' + Date.now(),
    status: 'successful',
    amount: 30.00,
    accountNumber: '0241234567',
    message: 'Disbursement successful',
    timestamp: new Date().toISOString()
  };
  
  return await sendWebhook('/api/webhooks/trendipay/disbursement', payload);
}

/**
 * Test disbursement webhook - failed payout
 */
async function testDisbursementFailed() {
  console.log('\n🧪 TEST 4: Disbursement Webhook - Failed Payout');
  console.log('═'.repeat(60));
  
  const payload = {
    reference: '660e8400-e29b-41d4-a716-446655440001',
    transactionId: 'TP' + Date.now(),
    status: 'failed',
    amount: 30.00,
    accountNumber: '0241234567',
    message: 'Invalid account',
    timestamp: new Date().toISOString()
  };
  
  return await sendWebhook('/api/webhooks/trendipay/disbursement', payload);
}

/**
 * Test health endpoint
 */
async function testHealth() {
  console.log('\n🧪 TEST 0: Health Check');
  console.log('═'.repeat(60));
  
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();
    console.log('✅ Server is healthy:', data);
    return true;
  } catch (error) {
    console.error('❌ Server is not running:', error.message);
    console.log('\n💡 Start the server with: npm start');
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('\n🚀 TrendiPay Webhook Testing Suite');
  console.log('═'.repeat(60));
  console.log(`Target: ${BASE_URL}`);
  console.log(`Secret: ${WEBHOOK_SECRET.substring(0, 10)}...`);
  
  // Check if server is running
  const isHealthy = await testHealth();
  if (!isHealthy) {
    process.exit(1);
  }
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Run tests
  await testCollectionSuccess();
  await new Promise(resolve => setTimeout(resolve, 500));
  
  await testCollectionFailed();
  await new Promise(resolve => setTimeout(resolve, 500));
  
  await testDisbursementSuccess();
  await new Promise(resolve => setTimeout(resolve, 500));
  
  await testDisbursementFailed();
  
  console.log('\n✅ All tests completed!');
  console.log('\n📝 Notes:');
  console.log('- Replace reference UUIDs with actual payment IDs from your database');
  console.log('- Check server logs for detailed processing information');
  console.log('- Verify database records in Supabase');
}

// Run tests
runTests().catch(error => {
  console.error('\n❌ Test suite failed:', error);
  process.exit(1);
});
