const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Bulgarian numbers arrive as "p:+359888000111", "359888000222",
 * "3590888000333" (extra trunk zero), "0888123456" or bare "888000444".
 * Returns E.164 (+359XXXXXXXXX) or null when it can't be trusted.
 */
export function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/^p:/i, '').replace(/[\s\-().]/g, '');
  if (!cleaned) return null;

  const hasPlus = cleaned.startsWith('+');
  let digits = cleaned.replace(/^\+/, '').replace(/^00/, '');
  if (!/^\d+$/.test(digits)) return null;

  if (digits.startsWith('3590')) digits = `359${digits.slice(4)}`;
  if (digits.startsWith('359')) {
    return digits.length === 12 ? `+${digits}` : null;
  }
  if (digits.startsWith('0') && digits.length === 10) return `+359${digits.slice(1)}`;
  if (!hasPlus && digits.length === 9 && /^[89]/.test(digits)) return `+359${digits}`;
  if (hasPlus && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

/** "+359888000111" -> "+359 88 800 0111" */
export function formatPhone(e164: string): string {
  const m = e164.match(/^\+359(\d{2})(\d{3})(\d{4})$/);
  return m ? `+359 ${m[1]} ${m[2]} ${m[3]}` : e164;
}

export function normalizeEmail(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  return EMAIL_RE.test(value) ? value : null;
}

/**
 * Meta lead exports use "2023-09-03T19:41:42+03:00"; some pasted rows carry a
 * stray "cre" prefix ("cre2023-09-12T14:53:13+0000") or "2023-10-11 13:25:30".
 */
export function parseDate(raw: string): string | null {
  const value = raw.trim().replace(/^[a-z]+(?=\d{4}-)/i, '');
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const iso = value
    .replace(' ', 'T')
    .replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Meta form field keys come through as "от_какво_лечение_имате_нужда?" */
export function humanize(raw: string): string {
  const text = raw.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** Deep links for the messengers Bulgarian leads actually use. Expects E.164. */
export function viberLink(e164: string) {
  return `viber://chat?number=${encodeURIComponent(e164)}`;
}

export function whatsappLink(e164: string) {
  return `https://wa.me/${e164.replace(/^\+/, '')}`;
}
