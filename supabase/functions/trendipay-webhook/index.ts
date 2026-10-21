// @ts-nocheck
/**
 * trendipay-webhook – Supabase Edge Function
 *
 * Receives asynchronous payment callbacks from TrendiPay after a client
 * approves or rejects a collection/disbursement on their phone.
 *
 * TrendiPay sends a POST to this URL with the transaction result, signed with
 * HMAC-SHA256 of the raw body (x-trendipay-signature, TRENDIPAY_WEBHOOK_SECRET).
 *
 * - Collector withdrawals (reference = withdrawals.id, sent by
 *   trendipay-proxy): the result is also confirmed with TrendiPay's
 *   transaction-status API, and the amount checked, before
 *   td_complete_payout() marks the withdrawal completed or failed.
 * - Anything else: collections; updates a pending `bin_payments` row.
 *
 * Permanent callback URL:
 *   https://<project-ref>.supabase.co/functions/v1/trendipay-webhook
 *
 * Required Deno env secrets:
 *   SUPABASE_URL              – project URL (auto-available)
 *   Supabase secret key       – see _shared/supabaseKeys.ts
 *   TRENDIPAY_WEBHOOK_SECRET  – verifies x-trendipay-signature
 *   TRENDIPAY_API_URL, TRENDIPAY_API_KEY, TRENDIPAY_MERCHANT_ID
 *                             – to confirm withdrawal results with TrendiPay
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getSecretKey } from '../_shared/supabaseKeys.ts';
const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization, x-trendipay-signature'
};
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...CORS_HEADERS
    }
  });
}
function getSupabaseAdmin() {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = getSecretKey();
  if (!url || !key) throw new Error('Missing SUPABASE_URL or Supabase secret key');
  return createClient(url, key);
}
async function hmacSha256Hex(secret, body) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), {
    name: 'HMAC',
    hash: 'SHA-256'
  }, false, [
    'sign'
  ]);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return Array.from(new Uint8Array(sig)).map((b)=>b.toString(16).padStart(2, '0')).join('');
}
function timingSafeEqualHex(a, b) {
  const x = a.trim().toLowerCase().replace(/^sha256=/, '');
  const y = b.toLowerCase();
  if (x.length !== y.length) return false;
  let diff = 0;
  for(let i = 0; i < x.length; i++)diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// TrendiPay status words → success | failed | pending
function mapGatewayStatus(status: unknown, code?: unknown): 'success' | 'failed' | 'pending' {
  const s = String(status ?? '').toLowerCase();
  if (['successful', 'success', 'completed'].includes(s) || code === '000') return 'success';
  if (['failed', 'declined', 'expired', 'canceled', 'cancelled', 'reversed'].includes(s)) return 'failed';
  return 'pending';
}

// Ask TrendiPay for the real result of a transaction (by rrn)
async function fetchTrendiPayStatus(rrn: string): Promise<{ data?: any; error?: string }> {
  const apiUrl = (Deno.env.get('TRENDIPAY_API_URL') ?? '').replace(/\/$/, '');
  const apiKey = Deno.env.get('TRENDIPAY_API_KEY') ?? '';
  const merchantId = Deno.env.get('TRENDIPAY_MERCHANT_ID') ?? '';
  if (!apiUrl || !apiKey || !merchantId) return { error: 'TrendiPay API not configured' };
  try {
    const resp = await fetch(`${apiUrl}/v1/merchants/${merchantId}/transactions/${encodeURIComponent(rrn)}/status`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json', 'X-Merchant-ID': merchantId },
    });
    const text = await resp.text();
    if (!resp.ok) return { error: `Status API HTTP ${resp.status}: ${text.substring(0, 200)}` };
    const body = JSON.parse(text);
    return { data: body?.data ?? body };
  } catch (err: any) {
    return { error: err?.message || 'Status API request failed' };
  }
}

// A collector withdrawal: confirm with TrendiPay, then complete or fail it
async function handleWithdrawalCallback(supabase: any, withdrawal: any, payload: any) {
  const id = withdrawal.id;
  if (withdrawal.status !== 'processing') {
    console.log(`[trendipay-webhook] Withdrawal ${id} is ${withdrawal.status}; nothing to do`);
    return json({ success: true, message: `Withdrawal already ${withdrawal.status}` });
  }

  const rrn = withdrawal.gateway_transaction_id || payload.rrn || payload.externalId;
  if (!rrn) {
    console.error(`[trendipay-webhook] Withdrawal ${id}: no transaction reference to confirm with`);
    return json({ success: false, error: 'No transaction reference to confirm' }, 200);
  }

  const { data: verified, error: verifyError } = await fetchTrendiPayStatus(String(rrn));
  if (verifyError) {
    // Can't confirm right now: leave it processing; 503 lets TrendiPay retry
    console.error(`[trendipay-webhook] Withdrawal ${id}: could not confirm with TrendiPay:`, verifyError);
    return json({ success: false, error: 'Could not confirm with TrendiPay' }, 503);
  }

  const result = mapGatewayStatus(verified?.status, verified?.code);
  if (result === 'pending') {
    return json({ success: true, message: 'Acknowledged (still pending)' });
  }

  // The confirmed transaction must be this withdrawal, for this amount
  // (TrendiPay amounts are in pesewas; accept GHS too)
  const expected = Number(withdrawal.amount);
  const got = Number(verified?.amount);
  const amountOk = !Number.isFinite(got) || Math.round(got) === Math.round(expected * 100) || Math.abs(got - expected) < 0.005;
  const refOk = !verified?.reference || String(verified.reference) === String(id);
  if (!amountOk || !refOk) {
    console.error(`[trendipay-webhook] Withdrawal ${id}: confirmed transaction does not match`, { expected, got, reference: verified?.reference });
    return json({ success: false, error: 'Transaction does not match the withdrawal' }, 200);
  }

  const { data: outcome, error } = await supabase.rpc('td_complete_payout', {
    p_withdrawal_id: id,
    p_ok: result === 'success',
    p_transaction_id: String(rrn),
    p_response: { callback: payload, verified },
    p_error: result === 'failed' ? (verified?.reason || verified?.message || 'Payout failed') : null,
  });
  if (error) {
    console.error(`[trendipay-webhook] td_complete_payout failed for ${id}:`, error.message);
    return json({ success: false, error: 'Database update failed' }, 503);
  }

  console.log(`[trendipay-webhook] ✅ Withdrawal ${id}: ${outcome}`);
  return json({ success: true, reference: id, status: outcome });
}

Deno.serve(async (req)=>{
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS
    });
  }
  if (req.method !== 'POST') {
    return json({
      success: false,
      error: 'Method not allowed'
    }, 405);
  }
  const webhookSecret = Deno.env.get('TRENDIPAY_WEBHOOK_SECRET') ?? '';
  if (!webhookSecret) {
    console.error('[trendipay-webhook] TRENDIPAY_WEBHOOK_SECRET not set — rejecting');
    return json({
      success: false,
      error: 'Webhook not configured'
    }, 500);
  }
  const rawBody = await req.text();
  const signature = req.headers.get('x-trendipay-signature') ?? '';
  if (!signature) {
    return json({
      success: false,
      error: 'Missing signature'
    }, 401);
  }
  const expected = await hmacSha256Hex(webhookSecret, rawBody);
  if (!timingSafeEqualHex(signature, expected)) {
    console.warn('[trendipay-webhook] Invalid signature for request');
    return json({
      success: false,
      error: 'Invalid signature'
    }, 401);
  }
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch  {
    return json({
      success: false,
      error: 'Invalid JSON body'
    }, 400);
  }
  console.log('[trendipay-webhook] Received callback:', JSON.stringify(payload).substring(0, 1000));
  // TrendiPay callback payload structure (from their docs):
  // The callback sends the full transaction object as the body
  // Key fields: reference, status, code, responseCode, reason, rrn, amount, type
  const { reference, status, code, responseCode, reason, rrn, externalId, amount, type } = payload;
  if (!reference) {
    console.error('[trendipay-webhook] No reference in payload');
    return json({
      success: false,
      error: 'Missing reference'
    }, 400);
  }
  // Collector withdrawals are handled separately and confirmed with TrendiPay
  if (UUID.test(String(reference))) {
    try {
      const supabase = getSupabaseAdmin();
      const { data: withdrawal, error } = await supabase
        .from('withdrawals')
        .select('id, status, amount, gateway_transaction_id')
        .eq('id', reference)
        .maybeSingle();
      if (error) {
        console.error('[trendipay-webhook] Withdrawal lookup failed:', error.message);
        return json({ success: false, error: 'Database lookup failed' }, 503);
      }
      if (withdrawal) return await handleWithdrawalCallback(supabase, withdrawal, payload);
    } catch (err: any) {
      console.error('[trendipay-webhook] Withdrawal handling error:', err.message);
      return json({ success: false, error: err.message }, 503);
    }
  }

  // Map TrendiPay status to our system status
  let systemStatus;
  if (status === 'successful' || code === '000' || responseCode === '00') {
    systemStatus = 'success';
  } else if (status === 'failed' || code && code !== '000' && code !== '111') {
    systemStatus = 'failed';
  } else if (status === 'pending' || code === '111') {
    // Still pending — don't update yet
    console.log(`[trendipay-webhook] Transaction ${reference} still pending, ignoring callback`);
    return json({
      success: true,
      message: 'Acknowledged (still pending)'
    });
  } else {
    systemStatus = 'failed';
  }
  console.log(`[trendipay-webhook] Mapping: status=${status}, code=${code}, responseCode=${responseCode} → ${systemStatus}`);
  try {
    const supabase = getSupabaseAdmin();
    // Update bin_payments record
    const updateData = {
      status: systemStatus,
      updated_at: new Date().toISOString()
    };
    if (rrn) updateData.gateway_reference = rrn;
    if (externalId) updateData.gateway_transaction_id = externalId;
    if (systemStatus === 'failed') {
      updateData.gateway_error = reason || `Payment ${status} (code: ${code})`;
    }
    const { data: updatedPayment, error: updateError } = await supabase.from('bin_payments').update(updateData).eq('status', 'pending').eq('id', reference).select('id, digital_bin_id, collector_id, status').single();
    if (updateError) {
      console.error('[trendipay-webhook] DB update error:', updateError.message);
      // Still return 200 so TrendiPay doesn't retry endlessly
      return json({
        success: false,
        error: 'Database update failed'
      }, 200);
    }
    console.log(`[trendipay-webhook] ✅ Payment ${reference} updated to: ${systemStatus}`);
    // If collection succeeded, update digital_bin status to 'disposed'
    if (systemStatus === 'success' && updatedPayment?.digital_bin_id) {
      const { error: binError } = await supabase.from('digital_bins').update({
        status: 'disposed',
        collected_at: new Date().toISOString()
      }).eq('id', updatedPayment.digital_bin_id);
      if (binError) {
        console.error('[trendipay-webhook] Failed to update digital_bin:', binError.message);
      } else {
        console.log(`[trendipay-webhook] ✅ Digital bin ${updatedPayment.digital_bin_id} marked as disposed`);
      }
    }
    return json({
      success: true,
      message: 'Webhook processed',
      reference,
      status: systemStatus
    });
  } catch (err) {
    console.error('[trendipay-webhook] Error:', err.message);
    return json({
      success: false,
      error: err.message
    }, 200);
  }
});
