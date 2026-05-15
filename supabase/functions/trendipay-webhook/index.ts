// @ts-nocheck
/**
 * trendipay-webhook – Supabase Edge Function
 *
 * Receives asynchronous payment callbacks from TrendiPay after a client
 * approves or rejects a collection/disbursement on their phone.
 *
 * TrendiPay sends a POST to this URL with the transaction result.
 * This function updates the `bin_payments` table status accordingly.
 *
 * Permanent callback URL:
 *   https://<project-ref>.supabase.co/functions/v1/trendipay-webhook
 *
 * Required Deno env secrets:
 *   SUPABASE_URL             – project URL (auto-available)
 *   SUPABASE_SERVICE_ROLE_KEY – service role key for DB writes
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization, x-trendipay-signature',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}

function getSupabaseAdmin() {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405);
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ success: false, error: 'Invalid JSON body' }, 400);
  }

  console.log('[trendipay-webhook] Received callback:', JSON.stringify(payload).substring(0, 1000));

  // TrendiPay callback payload structure (from their docs):
  // The callback sends the full transaction object as the body
  // Key fields: reference, status, code, responseCode, reason, rrn, amount, type
  const {
    reference,       // Our bin_payments.id (we set this as the reference when initiating)
    status,          // "successful", "failed", "pending"
    code,            // "000" = success, "111" = pending, others = failed
    responseCode,    // "00" = approved
    reason,          // Human-readable reason
    rrn,             // Retrieval reference number
    externalId,      // TrendiPay external ID
    amount,
    type,            // "collection" or "disbursement"
  } = payload;

  if (!reference) {
    console.error('[trendipay-webhook] No reference in payload');
    return json({ success: false, error: 'Missing reference' }, 400);
  }

  // Map TrendiPay status to our system status
  let systemStatus: string;
  if (status === 'successful' || code === '000' || responseCode === '00') {
    systemStatus = 'success';
  } else if (status === 'failed' || (code && code !== '000' && code !== '111')) {
    systemStatus = 'failed';
  } else if (status === 'pending' || code === '111') {
    // Still pending — don't update yet
    console.log(`[trendipay-webhook] Transaction ${reference} still pending, ignoring callback`);
    return json({ success: true, message: 'Acknowledged (still pending)' });
  } else {
    systemStatus = 'failed';
  }

  console.log(`[trendipay-webhook] Mapping: status=${status}, code=${code}, responseCode=${responseCode} → ${systemStatus}`);

  try {
    const supabase = getSupabaseAdmin();

    // Update bin_payments record
    const updateData: any = {
      status: systemStatus,
      updated_at: new Date().toISOString(),
    };

    if (rrn) updateData.gateway_reference = rrn;
    if (externalId) updateData.gateway_transaction_id = externalId;
    if (systemStatus === 'failed') {
      updateData.gateway_error = reason || `Payment ${status} (code: ${code})`;
    }

    const { data: updatedPayment, error: updateError } = await supabase
      .from('bin_payments')
      .update(updateData)
      .eq('id', reference)
      .select('id, digital_bin_id, collector_id, status')
      .single();

    if (updateError) {
      console.error('[trendipay-webhook] DB update error:', updateError.message);
      // Still return 200 so TrendiPay doesn't retry endlessly
      return json({ success: false, error: 'Database update failed' }, 200);
    }

    console.log(`[trendipay-webhook] ✅ Payment ${reference} updated to: ${systemStatus}`);

    // If collection succeeded, update digital_bin status to 'disposed'
    if (systemStatus === 'success' && updatedPayment?.digital_bin_id) {
      const { error: binError } = await supabase
        .from('digital_bins')
        .update({
          status: 'disposed',
          collected_at: new Date().toISOString(),
        })
        .eq('id', updatedPayment.digital_bin_id);

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
      status: systemStatus,
    });
  } catch (err: any) {
    console.error('[trendipay-webhook] Error:', err.message);
    return json({ success: false, error: err.message }, 200);
  }
});
