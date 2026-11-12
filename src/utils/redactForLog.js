// Phone numbers (MoMo accounts) never go to the console in full: payment
// requests and gateway answers are logged through this. Keeps the first 3 and
// last 2 digits of any phone-number field, at any depth.
const PERSONAL_KEYS = /^(accountnumber|account_number|msisdn|phone|phonenumber|phone_number|momo|clientmomo|client_momo|mobilenumber)$/i;

export function redactForLog(value) {
  if (Array.isArray(value)) return value.map(redactForLog);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([k, v]) => {
    if (PERSONAL_KEYS.test(k) && v != null && typeof v !== 'object') {
      const s = String(v);
      return [k, s.length > 5 ? `${s.slice(0, 3)}***${s.slice(-2)}` : '***'];
    }
    return [k, redactForLog(v)];
  }));
}
