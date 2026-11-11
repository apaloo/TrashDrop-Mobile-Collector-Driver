import { Webhook } from "npm:standardwebhooks@1.0.0";

// Supabase Auth "Send SMS" hook -> Arkesel (Ghana).
// Auth is the Standard Webhooks signature, so verify_jwt is off.
// Secrets required: SEND_SMS_HOOK_SECRET (v1,whsec_...), ARKESEL_API_KEY, ARKESEL_SENDER_ID

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const fail = (status: number, message: string) =>
  json(status, { error: { http_code: status, message } });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return fail(405, "Method not allowed");

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  const hookSecret = (Deno.env.get("SEND_SMS_HOOK_SECRET") ?? "").replace("v1,whsec_", "");
  const apiKey = Deno.env.get("ARKESEL_API_KEY");
  const sender = Deno.env.get("ARKESEL_SENDER_ID");
  if (!hookSecret || !apiKey || !sender) return fail(500, "SMS hook is not configured");

  let event: { user: { phone: string }; sms: { otp: string } };
  try {
    event = new Webhook(hookSecret).verify(payload, headers) as typeof event;
  } catch {
    return fail(401, "Invalid signature");
  }

  const otp = event.sms.otp;
  // Supabase stores numbers without '+', e.g. 233200000000
  const phone = event.user.phone.replace(/^\+/, "");

  const message = `Your TrashDrop code is ${otp}\n\n@collector.trashdrops.com #${otp}`;

  try {
    const res = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ sender, message, recipients: [phone] }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || (out.status && out.status !== "success")) {
      console.error("Arkesel error", res.status, JSON.stringify(out));
      return fail(502, "SMS provider rejected the message");
    }
  } catch (e) {
    console.error("Arkesel request failed", String(e));
    return fail(502, "SMS provider unreachable");
  }

  return json(200, {});
});
