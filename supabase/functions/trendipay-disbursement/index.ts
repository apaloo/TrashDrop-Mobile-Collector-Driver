import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...extraHeaders
    }
  });
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqualHex(a: string, b: string) {
  const aa = a.toLowerCase();
  const bb = b.toLowerCase();

  if (aa.length !== bb.length) return false;

  let out = 0;
  for (let i = 0; i < aa.length; i++) {
    out |= aa.charCodeAt(i) ^ bb.charCodeAt(i);
  }
  return out === 0;
}

function mapTrendiPayStatusToSystem(status: string | undefined | null): 'pending' | 'processing' | 'success' | 'failed' {
  const s = (status || '').toString().toLowerCase();

  if (['successful', 'success', 'completed'].includes(s)) return 'success';
  if (['failed', 'declined', 'expired', 'canceled', 'cancelled'].includes(s)) return 'failed';
  if (['processing', 'in_progress'].includes(s)) return 'processing';
  if (['pending', 'initiated'].includes(s)) return 'pending';

  return 'failed';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type, x-trendipay-signature'
      }
    });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405, {
      'access-control-allow-origin': '*'
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ success: false, error: 'Server not configured (missing SUPABASE_URL or SERVICE_ROLE_KEY)' }, 500);
  }

  const signatureHeader = req.headers.get('x-trendipay-signature') ?? '';
  const webhookSecret = Deno.env.get('TRENDIPAY_WEBHOOK_SECRET') ?? '';

  const rawBody = await req.text();

  if (webhookSecret) {
    if (!signatureHeader) {
      return jsonResponse({ success: false, error: 'Missing signature' }, 401);
    }

    const expected = await hmacSha256Hex(webhookSecret, rawBody);
    if (!timingSafeEqualHex(signatureHeader, expected)) {
      return jsonResponse({ success: false, error: 'Invalid signature' }, 401);
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ success: false, error: 'Invalid JSON' }, 400);
  }

  const reference = payload?.reference;
  const transactionId = payload?.transactionId;
  const status = payload?.status;
  const message = payload?.message;

  if (!reference) {
    return jsonResponse({ success: false, error: 'Missing reference' }, 400);
  }

  const systemStatus = mapTrendiPayStatusToSystem(status);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  const updateData: Record<string, unknown> = {
    status: systemStatus,
    gateway_reference: transactionId ?? null,
    raw_gateway_response: payload,
    updated_at: new Date().toISOString()
  };

  if (systemStatus === 'failed') {
    updateData.gateway_error = message || `Disbursement ${status || 'failed'}`;
  }

  const { error: updateError } = await supabase
    .from('bin_payments')
    .update(updateData)
    .eq('id', reference)
    .eq('type', 'disbursement');

  if (updateError) {
    return jsonResponse({ success: false, error: updateError.message }, 500);
  }

  return jsonResponse({
    success: true,
    reference,
    status: systemStatus
  });
});
