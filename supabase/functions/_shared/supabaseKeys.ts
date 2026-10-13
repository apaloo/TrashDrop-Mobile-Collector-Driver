/**
 * Supabase API keys for Edge Functions.
 *
 * Prefers the new API keys (sb_publishable_... / sb_secret_...), which the
 * platform injects as SUPABASE_PUBLISHABLE_KEYS / SUPABASE_SECRET_KEYS and
 * keeps current when keys are rotated. Falls back to our own secrets, then to
 * the legacy JWT keys, so functions keep working until the legacy keys are
 * disabled.
 */

// The injected values are JSON maps of key name -> key, e.g. {"default": "sb_secret_..."}.
// Accept a map, an array, or a plain string to be safe.
function fromInjectedKeys(name: string): string {
  const raw = Deno.env.get(name) ?? '';
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'string') return parsed;
    if (Array.isArray(parsed)) return String(parsed[0] ?? '');
    if (parsed && typeof parsed === 'object') {
      return String(parsed.default ?? Object.values(parsed)[0] ?? '');
    }
  } catch {
    // Not JSON: use the value as-is
  }
  return raw;
}

/** Key for acting as the caller (RLS applies). */
export function getPublishableKey(): string {
  return (
    fromInjectedKeys('SUPABASE_PUBLISHABLE_KEYS') ||
    Deno.env.get('SB_PUBLISHABLE_KEY') ||
    Deno.env.get('SUPABASE_ANON_KEY') ||
    ''
  );
}

/** Server-only key that bypasses RLS. Never send it to a browser. */
export function getSecretKey(): string {
  return (
    fromInjectedKeys('SUPABASE_SECRET_KEYS') ||
    Deno.env.get('SERVICE_ROLE_KEY') ||
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
    ''
  );
}
