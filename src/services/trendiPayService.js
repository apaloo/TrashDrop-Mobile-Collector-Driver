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
  webhookSecret: import.meta.env.VITE_TRENDIPAY_WEBHOOK_SECRET || '', // Fix #4: Required for signature verification
  callbackBaseUrl: import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000',
  
  // Proxy URL: route TrendiPay API calls through Supabase Edge Function to avoid CORS
  // Falls back to the Supabase project's functions URL
  proxyUrl: (() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    if (supabaseUrl) {
      return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/trendipay-proxy`;
    }
    return '';
  })(),
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  
  // Timeouts and retries
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 2000, // 2 seconds
};

// === DEBUG: Log TrendiPay config on module load ===
console.log('🔧 [TrendiPay] Config loaded:', {
  apiUrl: TRENDIPAY_CONFIG.apiUrl,
  proxyUrl: TRENDIPAY_CONFIG.proxyUrl || '(empty — will call TrendiPay directly!)',
  hasAnonKey: !!TRENDIPAY_CONFIG.supabaseAnonKey,
  hasApiKey: !!TRENDIPAY_CONFIG.apiKey,
  apiKeyPrefix: TRENDIPAY_CONFIG.apiKey ? TRENDIPAY_CONFIG.apiKey.substring(0, 8) + '...' : '(empty)',
  terminalId: TRENDIPAY_CONFIG.terminalId || '(empty)',
  merchantId: TRENDIPAY_CONFIG.merchantId || '(empty)',
  hasWebhookSecret: !!TRENDIPAY_CONFIG.webhookSecret,
  callbackBaseUrl: TRENDIPAY_CONFIG.callbackBaseUrl || '(empty)',
  VITE_SUPABASE_FUNCTIONS_URL: import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || '(not set)',
  VITE_API_URL: import.meta.env.VITE_API_URL || '(not set)',
  VITE_ENABLE_TRENDIPAY: import.meta.env.VITE_ENABLE_TRENDIPAY || '(not set)',
});

function normalizePublicBaseUrl(rawBaseUrl) {
  const raw = (rawBaseUrl || '').trim();

  if (!raw) return '';

  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const withoutTrailingSlash = withScheme.replace(/\/+$/, '');

  try {
    const u = new URL(withoutTrailingSlash);
    if (u.protocol !== 'https:') {
      throw new Error('Callback base URL must use https');
    }
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
      throw new Error('Callback base URL cannot be localhost');
    }
    return u.toString();
  } catch (e) {
    logger.error('Invalid callback base URL:', { rawBaseUrl, error: e?.message });
    return '';
  }
}

function buildCallbackUrl(path) {
  const base = normalizePublicBaseUrl(TRENDIPAY_CONFIG.callbackBaseUrl);
  if (!base) {
    throw new Error(
      'Payment system not configured. Set VITE_SUPABASE_FUNCTIONS_URL to https://<project-ref>.functions.supabase.co'
    );
  }
  // Strip trailing slash from base to avoid double-slash
  const cleanBase = base.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const full = `${cleanBase}${cleanPath}`;
  // Ensure the final callback is a valid absolute URL
  try {
    new URL(full);
  } catch {
    throw new Error('Payment system not configured. Callback URL is invalid.');
  }
  return full;
}

/**
 * Network code mapping (TrendiPay rSwitch format — lowercase per official docs)
 */
const NETWORK_CODES = {
  mtn: 'mtn',
  vodafone: 'vodafone',
  airteltigo: 'airteltigo',
  // Aliases
  MTN: 'mtn',
  VODAFONE: 'vodafone',
  AIRTELTIGO: 'airteltigo'
};

/**
 * Make API request via the trendipay-proxy Supabase Edge Function.
 * Falls back to direct TrendiPay call if proxy URL is not configured.
 */
async function makeProxyRequest(action, payload = null, extra = {}, retryCount = 0) {
  const useProxy = !!TRENDIPAY_CONFIG.proxyUrl;

  console.log(`📡 [TrendiPay] makeProxyRequest — action: ${action}, useProxy: ${useProxy}, retryCount: ${retryCount}`);
  console.log(`📡 [TrendiPay] Payload:`, JSON.stringify(payload, null, 2));

  try {
    let url, options;

    if (useProxy) {
      // Route through Supabase Edge Function (avoids CORS)
      url = TRENDIPAY_CONFIG.proxyUrl;
      const proxyBody = {
        action,
        payload,
        terminalId: TRENDIPAY_CONFIG.terminalId,
        ...extra,
      };
      options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'apikey': TRENDIPAY_CONFIG.supabaseAnonKey,
          'Authorization': `Bearer ${TRENDIPAY_CONFIG.supabaseAnonKey}`,
        },
        body: JSON.stringify(proxyBody),
      };
      console.log(`📡 [TrendiPay] Proxy URL: ${url}`);
      console.log(`📡 [TrendiPay] Proxy body:`, JSON.stringify(proxyBody, null, 2));
    } else {
      // Direct call (will likely fail with CORS in browser)
      console.warn('⚠️ [TrendiPay] No proxy URL — calling TrendiPay directly (may fail with CORS)');
      const endpoint = extra.endpoint || '';
      const method = extra.method || 'POST';
      url = `${TRENDIPAY_CONFIG.apiUrl}${endpoint}`;
      options = {
        method,
        headers: {
          'Authorization': `Bearer ${TRENDIPAY_CONFIG.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Merchant-ID': TRENDIPAY_CONFIG.merchantId,
        },
      };
      if (payload && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(payload);
      }
    }

    const response = await fetch(url, options);
    console.log(`📡 [TrendiPay] Response status: ${response.status} ${response.statusText}`);

    let data;
    const rawText = await response.text();
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      console.error('❌ [TrendiPay] Non-JSON response:', rawText.substring(0, 500));
      throw new Error(`Invalid JSON response (status ${response.status}): ${rawText.substring(0, 200)}`);
    }

    console.log(`📡 [TrendiPay] Response body:`, JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error(`❌ [TrendiPay] API error ${response.status}:`, data);
      throw new Error(data.error || data.message || `API error: ${response.status}`);
    }

    // Proxy wraps TrendiPay response in { success, data }
    if (useProxy) {
      return data; // already { success: true, data: {...} } from proxy
    }

    return { success: true, data };

  } catch (error) {
    console.error('❌ [TrendiPay] Request failed:', {
      message: error.message,
      name: error.name,
      stack: error.stack?.split('\n').slice(0, 3).join('\n'),
    });

    // Retry for network errors
    if (retryCount < TRENDIPAY_CONFIG.retryAttempts &&
        (error.name === 'NetworkError' || error.name === 'TimeoutError' || error.message?.includes('Failed to fetch'))) {
      console.warn(`🔄 [TrendiPay] Retrying (${retryCount + 1}/${TRENDIPAY_CONFIG.retryAttempts})...`);
      await new Promise(resolve => setTimeout(resolve, TRENDIPAY_CONFIG.retryDelay));
      return makeProxyRequest(action, payload, extra, retryCount + 1);
    }

    return {
      success: false,
      error: error.message || 'API request failed',
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
    console.log('💳 [TrendiPay] === INITIATE COLLECTION ===');
    console.log('💳 [TrendiPay] Input params:', {
      reference,
      accountNumber: accountNumber?.substring(0, 6) + '***',
      rSwitch,
      amount,
      amountType: typeof amount,
      currency,
      description
    });
    
    // Validate inputs
    if (!reference || !accountNumber || !rSwitch || !amount) {
      const missing = [
        !reference && 'reference',
        !accountNumber && 'accountNumber',
        !rSwitch && 'rSwitch',
        !amount && 'amount'
      ].filter(Boolean);
      console.error('❌ [TrendiPay] Missing params:', missing);
      throw new Error(`Missing required collection parameters: ${missing.join(', ')}`);
    }
    
    if (amount <= 0) {
      console.error('❌ [TrendiPay] Invalid amount:', amount);
      throw new Error('Amount must be greater than zero');
    }
    
    // Validate callback URL is properly configured
    console.log('💳 [TrendiPay] Building callback URL from base:', TRENDIPAY_CONFIG.callbackBaseUrl);
    const callbackUrl = buildCallbackUrl('trendipay-collection');
    console.log('💳 [TrendiPay] Callback URL:', callbackUrl);
    
    // Convert amount from GHS to pesewas (TrendiPay requires amount in pesewas, minimum 100)
    const amountInPesewas = Math.round(parseFloat(amount) * 100);
    console.log('💳 [TrendiPay] Amount conversion:', { ghsAmount: amount, pesewas: amountInPesewas });
    
    if (amountInPesewas < 100) {
      console.error('❌ [TrendiPay] Amount too small:', amountInPesewas, 'pesewas');
      throw new Error('Amount must be at least 1.00 GHS (100 pesewas)');
    }
    
    // Map network to TrendiPay format (lowercase per official docs)
    const networkCode = NETWORK_CODES[rSwitch] || NETWORK_CODES[rSwitch.toLowerCase()] || rSwitch.toLowerCase();
    console.log('💳 [TrendiPay] Network mapping:', rSwitch, '→', networkCode);
    
    // Prepare request payload (matches official TrendiPay API spec)
    const payload = {
      reference,
      accountNumber,
      rSwitch: networkCode,
      amount: amountInPesewas, // Amount in pesewas (integer, no decimals)
      description: description || `Digital bin payment ${reference}`,
      callbackUrl
    };
    
    console.log('💳 [TrendiPay] Full payload:', JSON.stringify(payload, null, 2));
    
    // Call TrendiPay API via proxy
    const result = await makeProxyRequest('initiate-collection', payload);
    
    console.log('💳 [TrendiPay] API result:', JSON.stringify(result, null, 2));
    
    if (!result.success) {
      console.error('❌ [TrendiPay] Collection API failed:', result.error);
      throw new Error(result.error || 'Failed to initiate collection');
    }
    
    // Proxy returns { success, data: { success, code, data: { ...fields } } }
    // Actual transaction fields are nested in result.data.data
    const gatewayData = result.data;
    const data = (gatewayData && gatewayData.data) ? gatewayData.data : gatewayData;
    const txnId = data.rrn || data.externalId || data.transactionId;
    const txnStatus = data.status;
    const txnMessage = data.reason || data.message;
    
    console.log('✅ [TrendiPay] Collection initiated:', {
      reference,
      rrn: data.rrn,
      externalId: data.externalId,
      status: txnStatus,
      reason: txnMessage,
      authorizationSteps: data.authorizationSteps
    });
    
    return {
      success: true,
      transactionId: txnId,
      rrn: data.rrn,
      status: txnStatus, // 'pending', 'processing', 'success', 'failed'
      message: txnMessage || 'Payment initiated. Awaiting client approval.',
      gatewayReference: txnId,
      authorizationSteps: data.authorizationSteps, // MoMo approval instructions
      rawData: data
    };
    
  } catch (error) {
    console.error('❌ [TrendiPay] Collection error:', error.message, error);
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
    console.log('🔍 [TrendiPay] Checking transaction status:', { transactionId, reference });
    
    // Official API: GET /v1/merchants/:merchantID/transactions/:rrn/status
    const result = await makeProxyRequest('check-transaction-status', null, {
      transactionId, // rrn value
      merchantId: TRENDIPAY_CONFIG.merchantId
    });
    
    console.log('🔍 [TrendiPay] Status check result:', JSON.stringify(result, null, 2));
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to check status');
    }
    
    const gatewayData = result.data;
    const data = (gatewayData && gatewayData.data) ? gatewayData.data : gatewayData;
    const txnStatus = data.status;
    const txnMessage = data.reason || data.message;
    
    console.log('🔍 [TrendiPay] Transaction status:', { status: txnStatus, reason: txnMessage, amount: data.amount });
    
    return {
      success: true,
      status: txnStatus, // 'pending', 'processing', 'success', 'failed', 'expired'
      message: txnMessage,
      amount: data.amount,
      completedAt: data.lastUpdated,
      transactionId,
      rawData: data
    };
    
  } catch (error) {
    console.error('❌ [TrendiPay] Status check error:', error.message, error);
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
  accountName = '',
  senderName = 'TrashDrop',
  currency = 'GHS'
}) {
  try {
    console.log('💸 [TrendiPay] === INITIATE DISBURSEMENT ===');
    console.log('💸 [TrendiPay] Input params:', {
      reference,
      accountNumber: accountNumber?.substring(0, 6) + '***',
      rSwitch,
      amount,
      amountType: typeof amount,
      currency,
      description
    });
    
    // Validate inputs
    if (!reference || !accountNumber || !rSwitch || !amount) {
      const missing = [
        !reference && 'reference',
        !accountNumber && 'accountNumber',
        !rSwitch && 'rSwitch',
        !amount && 'amount'
      ].filter(Boolean);
      console.error('❌ [TrendiPay] Missing disbursement params:', missing);
      throw new Error(`Missing required disbursement parameters: ${missing.join(', ')}`);
    }
    
    if (amount <= 0) {
      console.error('❌ [TrendiPay] Invalid disbursement amount:', amount);
      throw new Error('Amount must be greater than zero');
    }
    
    // Convert amount from GHS to pesewas (TrendiPay requires amount in pesewas, minimum 100)
    const amountInPesewas = Math.round(parseFloat(amount) * 100);
    console.log('💸 [TrendiPay] Amount conversion:', { ghsAmount: amount, pesewas: amountInPesewas });
    
    if (amountInPesewas < 100) {
      console.error('❌ [TrendiPay] Disbursement amount too small:', amountInPesewas, 'pesewas');
      throw new Error('Amount must be at least 1.00 GHS (100 pesewas)');
    }
    
    // Map network to TrendiPay format (lowercase per official docs)
    const networkCode = NETWORK_CODES[rSwitch] || NETWORK_CODES[rSwitch.toLowerCase()] || rSwitch.toLowerCase();
    console.log('💸 [TrendiPay] Network mapping:', rSwitch, '→', networkCode);
    
    // Prepare request payload (matches official TrendiPay API spec)
    console.log('💸 [TrendiPay] Building callback URL from base:', TRENDIPAY_CONFIG.callbackBaseUrl);
    const callbackUrl = buildCallbackUrl('trendipay-disbursement');
    console.log('💸 [TrendiPay] Callback URL:', callbackUrl);

    const payload = {
      reference,
      accountNumber,
      rSwitch: networkCode,
      amount: amountInPesewas, // Amount in pesewas (integer, no decimals)
      description: description || `TrashDrop collector payout ${reference}`,
      accountName: accountName || accountNumber, // required by TrendiPay API
      senderName: senderName || 'TrashDrop',     // required by TrendiPay API
      callbackUrl
    };
    
    console.log('💸 [TrendiPay] Full payload:', JSON.stringify(payload, null, 2));
    
    // Call TrendiPay API via proxy
    const result = await makeProxyRequest('initiate-disbursement', payload);
    
    console.log('💸 [TrendiPay] API result:', JSON.stringify(result, null, 2));
    
    if (!result.success) {
      console.error('❌ [TrendiPay] Disbursement API failed:', result.error);
      throw new Error(result.error || 'Failed to initiate disbursement');
    }
    
    // Proxy returns { success, data: { success, code, data: { ...fields } } }
    const gatewayData = result.data;
    const data = (gatewayData && gatewayData.data) ? gatewayData.data : gatewayData;
    const txnId = data.rrn || data.externalId || data.transactionId;
    const txnStatus = data.status;
    const txnMessage = data.reason || data.message;
    
    console.log('✅ [TrendiPay] Disbursement initiated:', {
      reference,
      rrn: data.rrn,
      externalId: data.externalId,
      status: txnStatus,
      reason: txnMessage
    });
    
    return {
      success: true,
      transactionId: txnId,
      rrn: data.rrn,
      status: txnStatus, // 'pending', 'processing', 'success', 'failed'
      message: txnMessage || 'Disbursement initiated successfully.',
      gatewayReference: txnId,
      rawData: data
    };
    
  } catch (error) {
    console.error('❌ [TrendiPay] Disbursement error:', error.message, error);
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
    console.log('🔍 [TrendiPay] Checking disbursement status:', { transactionId, reference });
    
    // Uses same endpoint as collection status check
    const result = await makeProxyRequest('check-transaction-status', null, {
      transactionId, // rrn value
      merchantId: TRENDIPAY_CONFIG.merchantId
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to check status');
    }
    
    const data = result.data;
    const { status, amount } = data;
    const message = data.reason || data.message;
    const completedAt = data.lastUpdated;
    
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
 * Verify webhook signature using HMAC-SHA256 (Fix #4: Security validation)
 * 
 * TrendiPay signs webhooks with HMAC-SHA256 using your webhook secret.
 * The signature is sent in the X-TrendiPay-Signature header.
 * 
 * @param {string} signature - Signature from X-TrendiPay-Signature header
 * @param {Object|string} payload - Webhook payload (raw body string preferred)
 * @param {Object} options - Optional configuration
 * @param {string} options.algorithm - Hash algorithm (default: 'SHA-256')
 * @param {string} options.encoding - Signature encoding (default: 'hex')
 * @returns {Promise<boolean>} True if signature is valid
 */
export async function verifyWebhookSignature(signature, payload, options = {}) {
  try {
    const { algorithm = 'SHA-256', encoding = 'hex' } = options;
    
    // Validate inputs
    if (!signature) {
      logger.warn('Webhook signature missing');
      return false;
    }
    
    if (!TRENDIPAY_CONFIG.webhookSecret) {
      logger.error('CRITICAL: Webhook secret not configured! Set VITE_TRENDIPAY_WEBHOOK_SECRET');
      // In development, you might want to allow unsigned webhooks
      if (import.meta.env.DEV) {
        logger.warn('⚠️ DEV MODE: Allowing unsigned webhook (UNSAFE for production)');
        return true;
      }
      return false;
    }
    
    // Normalize payload to string
    const payloadString = typeof payload === 'string' 
      ? payload 
      : JSON.stringify(payload);
    
    // Use Web Crypto API (available in browsers and modern Node.js)
    const encoder = new TextEncoder();
    const keyData = encoder.encode(TRENDIPAY_CONFIG.webhookSecret);
    const messageData = encoder.encode(payloadString);
    
    // Import the secret key
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: algorithm },
      false,
      ['sign']
    );
    
    // Generate expected signature
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Timing-safe comparison to prevent timing attacks
    const isValid = timingSafeEqual(signature.toLowerCase(), expectedSignature.toLowerCase());
    
    if (!isValid) {
      logger.warn('Webhook signature mismatch', {
        receivedPrefix: signature.substring(0, 10) + '...',
        expectedPrefix: expectedSignature.substring(0, 10) + '...'
      });
    } else {
      logger.info('✅ Webhook signature verified successfully');
    }
    
    return isValid;
    
  } catch (error) {
    logger.error('Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * Timing-safe string comparison to prevent timing attacks
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} True if strings are equal
 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
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
