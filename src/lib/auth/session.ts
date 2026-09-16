export const SESSION_COOKIE = 'cx_session';
export const SESSION_DAYS = 30;

export type Session = { name: string; exp: number };

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function sign(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return toBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload))));
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(name: string, secret: string, now = Date.now()) {
  const session: Session = { name, exp: now + SESSION_DAYS * 24 * 60 * 60 * 1000 };
  const payload = toBase64Url(encoder.encode(JSON.stringify(session)));
  return `${payload}.${await sign(payload, secret)}`;
}

export async function readSessionToken(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): Promise<Session | null> {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  if (!safeEqual(signature, await sign(payload, secret))) return null;
  try {
    const session = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as Session;
    if (typeof session.name !== 'string' || typeof session.exp !== 'number') return null;
    return session.exp > now ? session : null;
  } catch {
    return null;
  }
}

export function passwordMatches(input: string, expected: string) {
  return safeEqual(input, expected);
}
