import { logger } from '../utils/logger';

/**
 * TrendiPay Gateway Service
 * 
 * Handles integration with TrendiPay API for:
 * - Collection (client pays TrashDrop)
 * - Disbursement (TrashDrop pays collector)
 * 
 * Documentation: https://trendipay.com/docs
 */

// Configuration
const TRENDIPAY_CONFIG = {
  // These should be environment variables in production
  // Vite uses import.meta.env, not process.env
  apiUrl: import.meta.env.VITE_TRENDIPAY_API_URL || 'https://api.trendipay.com',
  apiKey: import.meta.env.VITE_TRENDIPAY_API_KEY || '',
  terminalId: import.meta.env.VITE_TRENDIPAY_TERMINAL_ID || '',
  merchantId: import.meta.env.VITE_TRENDIPAY_MERCHANT_ID || '',
  callbackBaseUrl: import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000',
  
  // Timeouts and retries
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 2000, // 2 seconds
};

/**
 * Network code mapping (TrendiPay rSwitch format)
 */
const NETWORK_CODES = {
  mtn: 'MTN',
  vodafone: 'VODAFONE',
  airteltigo: 'AIRTELTIGO'
};

/**
 * Make authenticated API request to TrendiPay
 */
async function makeApiRequest(endpoint, method = 'POST', body = null, retryCount = 0) {
  try {
    const url = `${TRENDIPAY_CONFIG.apiUrl}${endpoint}`;
    
    logger.info(`TrendiPay API request: ${method} ${url}`, { body });
    
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${TRENDIPAY_CONFIG.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Merchant-ID': TRENDIPAY_CONFIG.merchantId
      },
      timeout: TRENDIPAY_CONFIG.timeout
    };
    
    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    const data = await response.json();
    
    logger.info(`TrendiPay API response: ${response.status}`, { data });
    
    if (!response.ok) {
      throw new Error(data.message || `API error: ${response.status}`);
    }
    
    return {
      success: true,
      data
    };
    
  } catch (error) {
    logger.error('TrendiPay API error:', error);
    
    // Retry logic for network errors
    if (retryCount < TRENDIPAY_CONFIG.retryAttempts && 
        (error.name === 'NetworkError' || error.name === 'TimeoutError')) {
      logger.warn(`Retrying TrendiPay request (${retryCount + 1}/${TRENDIPAY_CONFIG.retryAttempts})...`);
      await new Promise(resolve => setTimeout(resolve, TRENDIPAY_CONFIG.retryDelay));
      return makeApiRequest(endpoint, method, body, retryCount + 1);
    }
    
    return {
      success: false,
      error: error.message || 'API request failed'
    };
  }
}

/**
 * Initiate collection (client pays TrashDrop)
 * 
 * @param {Object} params - Collection parameters
 * @param {string} params.reference - Unique payment reference (e.g., bin_payment.id)
 * @param {string} params.accountNumber - Client's mobile money number
 * @param {string} params.rSwitch - Network code (MTN, VODAFONE, AIRTELTIGO)
 * @param {number} params.amount - Amount to collect in GHS
 * @param {string} params.description - Payment description
 * @param {string} params.currency - Currency code (default: GHS)
 * @returns {Promise<Object>} Result with transaction details
 */
export async function initiateCollection({
  reference,
  accountNumber,
  rSwitch,
  amount,
  description,
  currency = 'GHS'
}) {
  try {
    logger.info('Initiating TrendiPay collection:', {
      reference,
      accountNumber: accountNumber?.substring(0, 6) + '***', // Mask for logging
      rSwitch,
      amount,
      currency
    });
    
    // Validate inputs
    if (!reference || !accountNumber || !rSwitch || !amount) {
      throw new Error('Missing required collection parameters');
    }
    
    if (amount <= 0) {
      throw new Error('Amount must be greater than zero');
    }
    
    // Validate callback URL is properly configured
    const callbackUrl = `${TRENDIPAY_CONFIG.callbackBaseUrl}/trendipay-collection`;
    
    if (!TRENDIPAY_CONFIG.callbackBaseUrl) {
      throw new Error('Payment system not configured. VITE_API_URL must be set to your ngrok URL');
    }
    
    logger.info('Using callback URL:', callbackUrl);
    
    // Convert amount from GHS to pesewas (TrendiPay requires amount in pesewas, minimum 100)
    const amountInPesewas = Math.round(parseFloat(amount) * 100);
    
    if (amountInPesewas < 100) {
      throw new Error('Amount must be at least 1.00 GHS (100 pesewas)');
    }
    
    // Map network to TrendiPay format
    const networkCode = NETWORK_CODES[rSwitch.toLowerCase()] || rSwitch.toUpperCase();
    
    // Prepare request payload
    const payload = {
      reference,
      accountNumber,
      rSwitch: networkCode,
      amount: amountInPesewas, // Amount in pesewas (integer, no decimals)
      description: description || `Digital bin payment ${reference}`,
      callbackUrl,
      type: 'purchase', // TrendiPay transaction type for collections
      currency
    };
    
    // Call TrendiPay API
    const result = await makeApiRequest(`/v1/terminals/${TRENDIPAY_CONFIG.terminalId}/collections`, 'POST', payload);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to initiate collection');
    }
    
    // Extract response data
    const { transactionId, status, message, checkStatusUrl } = result.data;
    
    logger.info('Collection initiated successfully:', {
      reference,
      transactionId,
      status
    });
    
    return {
      success: true,
      transactionId,
      status, // 'pending', 'processing', 'success', 'failed'
      message: message || 'Payment initiated. Awaiting client approval.',
      checkStatusUrl,
      gatewayReference: transactionId
    };
    
  } catch (error) {
    logger.error('Error initiating collection:', error);
    return {
      success: false,
      error: error.message || 'Failed to initiate collection'
    };
  }
}

/**
 * Check collection status
 * 
 * @param {string} transactionId - TrendiPay transaction ID
 * @param {string} reference - Original payment reference
 * @returns {Promise<Object>} Current status
 */
export async function checkCollectionStatus(transactionId, reference) {
  try {
    logger.info('Checking collection status:', { transactionId, reference });
    
    const result = await makeApiRequest(
      `/v1/terminals/${TRENDIPAY_CONFIG.terminalId}/collections/${transactionId}`,
      'GET'
    );
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to check status');
    }
    
    const { status, message, amount, completedAt } = result.data;
    
    return {
      success: true,
      status, // 'pending', 'processing', 'success', 'failed', 'expired'
      message,
      amount,
      completedAt,
      transactionId
    };
    
  } catch (error) {
    logger.error('Error checking collection status:', error);
    return {
      success: false,
      error: error.message || 'Failed to check status'
    };
  }
}

/**
 * Initiate disbursement (TrashDrop pays collector)
 * 
 * @param {Object} params - Disbursement parameters
 * @param {string} params.reference - Unique disbursement reference (e.g., bin_payment.id)
 * @param {string} params.accountNumber - Collector's mobile money number
 * @param {string} params.rSwitch - Network code (MTN, VODAFONE, AIRTELTIGO)
 * @param {number} params.amount - Amount to disburse in GHS
 * @param {string} params.description - Disbursement description
 * @param {string} params.currency - Currency code (default: GHS)
 * @returns {Promise<Object>} Result with transaction details
 */
export async function initiateDisbursement({
  reference,
  accountNumber,
  rSwitch,
  amount,
  description,
  currency = 'GHS'
}) {
  try {
    logger.info('Initiating TrendiPay disbursement:', {
      reference,
      accountNumber: accountNumber?.substring(0, 6) + '***', // Mask for logging
      rSwitch,
      amount,
      currency
    });
    
    // Validate inputs
    if (!reference || !accountNumber || !rSwitch || !amount) {
      throw new Error('Missing required disbursement parameters');
    }
    
    if (amount <= 0) {
      throw new Error('Amount must be greater than zero');
    }
    
    // Convert amount from GHS to pesewas (TrendiPay requires amount in pesewas, minimum 100)
    const amountInPesewas = Math.round(parseFloat(amount) * 100);
    
    if (amountInPesewas < 100) {
      throw new Error('Amount must be at least 1.00 GHS (100 pesewas)');
    }
    
    // Map network to TrendiPay format
    const networkCode = NETWORK_CODES[rSwitch.toLowerCase()] || rSwitch.toUpperCase();
    
    // Prepare request payload
    const callbackUrl = `${TRENDIPAY_CONFIG.callbackBaseUrl}/trendipay-disbursement`;

    const payload = {
      reference,
      accountNumber,
      rSwitch: networkCode,
      amount: amountInPesewas, // Amount in pesewas (integer, no decimals)
      description: description || `TrashDrop collector payout ${reference}`,
      callbackUrl,
      type: 'payment', // TrendiPay transaction type for disbursements
      currency
    };
    
    // Call TrendiPay API
    const result = await makeApiRequest(`/v1/terminals/${TRENDIPAY_CONFIG.terminalId}/disbursements`, 'POST', payload);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to initiate disbursement');
    }
    
    // Extract response data
    const { transactionId, status, message, checkStatusUrl } = result.data;
    
    logger.info('Disbursement initiated successfully:', {
      reference,
      transactionId,
      status
    });
    
    return {
      success: true,
      transactionId,
      status, // 'pending', 'processing', 'success', 'failed'
      message: message || 'Disbursement initiated successfully.',
      checkStatusUrl,
      gatewayReference: transactionId
    };
    
  } catch (error) {
    logger.error('Error initiating disbursement:', error);
    return {
      success: false,
      error: error.message || 'Failed to initiate disbursement'
    };
  }
}

/**
 * Check disbursement status
 * 
 * @param {string} transactionId - TrendiPay transaction ID
 * @param {string} reference - Original disbursement reference
 * @returns {Promise<Object>} Current status
 */
export async function checkDisbursementStatus(transactionId, reference) {
  try {
    logger.info('Checking disbursement status:', { transactionId, reference });
    
    const result = await makeApiRequest(
      `/v1/terminals/${TRENDIPAY_CONFIG.terminalId}/disbursements/${transactionId}`,
      'GET'
    );
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to check status');
    }
    
    const { status, message, amount, completedAt } = result.data;
    
    return {
      success: true,
      status, // 'pending', 'processing', 'success', 'failed', 'expired'
      message,
      amount,
      completedAt,
      transactionId
    };
    
  } catch (error) {
    logger.error('Error checking disbursement status:', error);
    return {
      success: false,
      error: error.message || 'Failed to check status'
    };
  }
}

/**
 * Verify webhook signature (security validation)
 * 
 * @param {string} signature - Signature from webhook header
 * @param {Object} payload - Webhook payload
 * @returns {boolean} True if signature is valid
 */
export function verifyWebhookSignature(signature, payload) {
  try {
    // TrendiPay uses HMAC-SHA256 for webhook signatures
    // Implementation would depend on their specific signature algorithm
    // For now, return true (implement proper verification in production)
    
    logger.info('Verifying webhook signature...');
    
    // TODO: Implement actual signature verification
    // const expectedSignature = crypto
    //   .createHmac('sha256', TRENDIPAY_CONFIG.webhookSecret)
    //   .update(JSON.stringify(payload))
    //   .digest('hex');
    // return signature === expectedSignature;
    
    return true;
  } catch (error) {
    logger.error('Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * Test API connection and credentials
 * 
 * @returns {Promise<Object>} Connection test result
 */
export async function testConnection() {
  try {
    logger.info('Testing TrendiPay API connection...');
    
    if (!TRENDIPAY_CONFIG.apiKey || !TRENDIPAY_CONFIG.merchantId) {
      throw new Error('TrendiPay credentials not configured');
    }
    
    const result = await makeApiRequest('/ping', 'GET');
    
    if (!result.success) {
      throw new Error('Connection test failed');
    }
    
    logger.info('TrendiPay API connection successful');
    
    return {
      success: true,
      message: 'Connected to TrendiPay API',
      config: {
        apiUrl: TRENDIPAY_CONFIG.apiUrl,
        merchantId: TRENDIPAY_CONFIG.merchantId,
        hasApiKey: !!TRENDIPAY_CONFIG.apiKey
      }
    };
    
  } catch (error) {
    logger.error('TrendiPay connection test failed:', error);
    return {
      success: false,
      error: error.message || 'Connection test failed'
    };
  }
}

export default {
  initiateCollection,
  checkCollectionStatus,
  initiateDisbursement,
  checkDisbursementStatus,
  verifyWebhookSignature,
  testConnection
};
