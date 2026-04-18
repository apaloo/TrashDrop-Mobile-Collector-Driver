// @ts-nocheck
/**
 * trendipay-proxy – Supabase Edge Function
 *
 * Proxies outbound TrendiPay API calls so the browser never talks to
 * test-api.trendipay.com directly (which would be blocked by CORS).
 *
 * Routes:
 *   POST /  { action: "initiate-collection", payload: {...} }
 *   POST /  { action: "initiate-disbursement", payload: {...} }
 *   POST /  { action: "check-collection-status", transactionId, terminalId }
 *   POST /  { action: "check-disbursement-status", transactionId, terminalId }
 *
 * Required Deno env secrets (set via `supabase secrets set`):
 *   TRENDIPAY_API_URL        – e.g. https://test-api.trendipay.com
 *   TRENDIPAY_API_KEY        – Bearer token
 *   TRENDIPAY_MERCHANT_ID    – X-Merchant-ID header value
 */

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization, apikey',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405);
  }

  // Read env
  const apiUrl = Deno.env.get('TRENDIPAY_API_URL') ?? '';
  const apiKey = Deno.env.get('TRENDIPAY_API_KEY') ?? '';
  const merchantId = Deno.env.get('TRENDIPAY_MERCHANT_ID') ?? '';

  if (!apiUrl || !apiKey) {
    console.error('[trendipay-proxy] Missing TRENDIPAY_API_URL or TRENDIPAY_API_KEY');
    return json({ success: false, error: 'Payment gateway not configured on server' }, 500);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: 'Invalid JSON body' }, 400);
  }

  const { action, payload, transactionId, terminalId } = body;

  if (!action) {
    return json({ success: false, error: 'Missing action field' }, 400);
  }

  let endpoint = '';
  let method = 'POST';
  let requestBody: any = undefined;

  const tid = terminalId || payload?.terminalId || '';

  switch (action) {
    case 'initiate-collection':
      if (!tid) return json({ success: false, error: 'Missing terminalId' }, 400);
      endpoint = `/v1/terminals/${tid}/collections`;
      requestBody = payload;
      break;

    case 'initiate-disbursement':
      if (!tid) return json({ success: false, error: 'Missing terminalId' }, 400);
      endpoint = `/v1/terminals/${tid}/disbursements`;
      requestBody = payload;
      break;

    case 'check-transaction-status':
    case 'check-collection-status':
    case 'check-disbursement-status': {
      // Official API: GET /v1/merchants/:merchantID/transactions/:rrn/status
      const mid = body.merchantId || merchantId;
      if (!mid || !transactionId) return json({ success: false, error: 'Missing merchantId or transactionId (rrn)' }, 400);
      endpoint = `/v1/merchants/${mid}/transactions/${transactionId}/status`;
      method = 'GET';
      break;
    }

    default:
      return json({ success: false, error: `Unknown action: ${action}` }, 400);
  }

  const url = `${apiUrl}${endpoint}`;
  const maskedKey = apiKey.length > 8 ? `${apiKey.substring(0, 6)}...${apiKey.slice(-4)}` : '***';
  console.log(`[trendipay-proxy] ${method} ${url} | key=${maskedKey} | merchant=${merchantId} | tid=${tid}`);

  try {
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Merchant-ID': merchantId,
      },
    };

    if (requestBody && (method === 'POST' || method === 'PUT')) {
      fetchOptions.body = JSON.stringify(requestBody);
    }

    const resp = await fetch(url, fetchOptions);
    const rawText = await resp.text();

    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      console.error('[trendipay-proxy] Non-JSON response:', rawText.substring(0, 500));
      return json({ success: false, error: `Gateway returned non-JSON (HTTP ${resp.status})` }, 502);
    }

    console.log(`[trendipay-proxy] Response ${resp.status}:`, JSON.stringify(data).substring(0, 500));

    if (!resp.ok) {
      return json({
        success: false,
        error: data.message || `Gateway error: ${resp.status}`,
        gatewayStatus: resp.status,
        gatewayResponse: data,
      }, resp.status >= 500 ? 502 : resp.status);
    }

    return json({ success: true, data });
  } catch (err: any) {
    console.error('[trendipay-proxy] Fetch error:', err.message);
    return json({ success: false, error: err.message || 'Gateway request failed' }, 502);
  }
});
