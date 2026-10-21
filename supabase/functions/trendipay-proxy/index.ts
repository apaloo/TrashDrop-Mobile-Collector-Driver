// @ts-nocheck
/**
 * trendipay-proxy – Supabase Edge Function
 *
 * Proxies outbound TrendiPay API calls so the browser never talks to
 * api.trendipay.com directly (which would be blocked by CORS).
 *
 * Routes:
 *   POST /  { action: "initiate-collection", payload: {...} }
 *   POST /  { action: "initiate-disbursement", payload: {...} }
 *   POST /  { action: "check-collection-status", transactionId, terminalId }
 *   POST /  { action: "check-disbursement-status", transactionId, terminalId }
 *
 * initiate-disbursement sends money out, so it requires the caller's Supabase
 * JWT (Authorization: Bearer <access_token>) and an active collector profile
 * (public.is_active_collector). payload.reference must be one of the caller's
 * pending withdrawals (created by request_withdrawal) and payload.amount must
 * equal it in pesewas; td_begin_payout marks it processing first, so a
 * withdrawal can only be paid once, and td_finish_payout records the result.
 * Other actions are unchanged.
 *
 * Required Deno env secrets (set via `supabase secrets set`):
 *   TRENDIPAY_API_URL        – e.g. https://api.trendipay.com
 *   TRENDIPAY_API_KEY        – Bearer token
 *   TRENDIPAY_MERCHANT_ID    – X-Merchant-ID header value
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getPublishableKey, getSecretKey } from '../_shared/supabaseKeys.ts';

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization, apikey',
};

// Resolve the caller from their JWT and check they are an active collector.
// Returns { userId } when allowed, or { denied } with an error response.
async function requireActiveCollector(req: Request): Promise<{ userId?: string; denied?: Response }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = getPublishableKey();
  const authHeader = req.headers.get('authorization') ?? '';

  if (!supabaseUrl || !anonKey) {
    return { denied: json({ success: false, error: 'Server not configured (missing SUPABASE_URL or Supabase publishable key)' }, 500) };
  }
  if (!/^Bearer\s+\S+/i.test(authHeader)) {
    return { denied: json({ success: false, error: 'Sign in to cash out' }, 401) };
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { denied: json({ success: false, error: 'Sign in to cash out' }, 401) };
  }

  const { data: isActive, error: rpcError } = await supabase.rpc('is_active_collector', { p_user_id: user.id });
  if (rpcError) {
    console.error('[trendipay-proxy] is_active_collector failed:', rpcError.message);
    return { denied: json({ success: false, error: 'Could not verify collector account' }, 500) };
  }
  if (isActive !== true) {
    return { denied: json({ success: false, error: 'Only registered, active collectors can cash out' }, 403) };
  }
  return { userId: user.id };
}

function adminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const secretKey = getSecretKey();
  if (!supabaseUrl || !secretKey) return null;
  return createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });
}

const lastNineDigits = (value: unknown) => String(value ?? '').replace(/\D/g, '').slice(-9);

// Record the gateway result on the withdrawal (failed frees its items again)
async function finishPayout(admin: any, withdrawalId: string, ok: boolean, details: { transactionId?: string; response?: unknown; error?: string }) {
  const { error } = await admin.rpc('td_finish_payout', {
    p_withdrawal_id: withdrawalId,
    p_ok: ok,
    p_transaction_id: details.transactionId ?? null,
    p_response: details.response ?? null,
    p_error: details.error ?? null,
  });
  if (error) console.error('[trendipay-proxy] td_finish_payout failed:', error.message);
}

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
  let admin: any = null;
  let payoutWithdrawalId: string | null = null;
  let method = 'POST';
  let requestBody: any = undefined;

  const tid = terminalId || payload?.terminalId || '';

  switch (action) {
    case 'initiate-collection':
      if (!tid) return json({ success: false, error: 'Missing terminalId' }, 400);
      endpoint = `/v1/terminals/${tid}/collections`;
      requestBody = payload;
      break;

    case 'initiate-disbursement': {
      const { userId, denied } = await requireActiveCollector(req);
      if (denied) return denied;
      if (!tid) return json({ success: false, error: 'Missing terminalId' }, 400);

      admin = adminClient();
      if (!admin) return json({ success: false, error: 'Server not configured (missing Supabase secret key)' }, 500);

      // The amount must be the collector's own pending withdrawal, exactly;
      // this also marks it processing so it can't be paid twice
      const { data: claim, error: claimError } = await admin.rpc('td_begin_payout', {
        p_withdrawal_id: payload?.reference ?? null,
        p_user_id: userId,
        p_amount_pesewas: Number.isFinite(Number(payload?.amount)) ? Math.round(Number(payload.amount)) : -1,
      });
      if (claimError) {
        const status = claimError.code === 'P0002' ? 404 : claimError.code === '42501' ? 403 : 409;
        return json({ success: false, error: claimError.message || 'Cash-out could not be started' }, status);
      }
      payoutWithdrawalId = claim.withdrawal_id;

      if (lastNineDigits(payload?.accountNumber) !== lastNineDigits(claim.phone_number)) {
        await finishPayout(admin, payoutWithdrawalId!, false, { error: 'Mobile money number does not match the cash-out' });
        return json({ success: false, error: 'Mobile money number does not match the cash-out' }, 409);
      }

      endpoint = `/v1/terminals/${tid}/disbursements`;
      requestBody = payload;
      break;
    }

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
      if (payoutWithdrawalId) {
        // Unknown outcome: keep it processing (items stay locked) for a manual check
        await finishPayout(admin, payoutWithdrawalId, true, {
          response: { unknown: true, httpStatus: resp.status, body: rawText.substring(0, 2000), note: 'Gateway result unknown; check TrendiPay before retrying' },
        });
      }
      return json({ success: false, error: `Gateway returned non-JSON (HTTP ${resp.status})` }, 502);
    }

    console.log(`[trendipay-proxy] Response ${resp.status}:`, JSON.stringify(data).substring(0, 500));

    if (payoutWithdrawalId) {
      const body = data?.data ?? data;
      const bodyStatus = String(body?.status ?? '').toLowerCase();
      const refused = ['failed', 'declined', 'expired', 'canceled', 'cancelled'].includes(bodyStatus);
      if ((!resp.ok && resp.status < 500) || refused) {
        // Clearly refused: mark failed so the earnings can be cashed out again
        await finishPayout(admin, payoutWithdrawalId, false, {
          response: data,
          error: body?.reason || data?.message || `Gateway error: ${resp.status}`,
        });
      } else if (!resp.ok) {
        // Gateway 5xx: outcome unknown, keep it processing for a manual check
        await finishPayout(admin, payoutWithdrawalId, true, {
          response: { unknown: true, httpStatus: resp.status, body: data, note: 'Gateway result unknown; check TrendiPay before retrying' },
        });
      } else {
        await finishPayout(admin, payoutWithdrawalId, true, {
          transactionId: body?.rrn || body?.externalId || body?.transactionId || null,
          response: data,
        });
      }
    }

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
    if (payoutWithdrawalId) {
      // The request may or may not have reached TrendiPay: keep it processing
      await finishPayout(admin, payoutWithdrawalId, true, {
        response: { unknown: true, error: err.message, note: 'Gateway result unknown; check TrendiPay before retrying' },
      });
    }
    return json({ success: false, error: err.message || 'Gateway request failed' }, 502);
  }
});
