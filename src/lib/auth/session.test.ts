import { describe, expect, it } from 'vitest';
import { createSessionToken, passwordMatches, readSessionToken } from './session';

const secret = 'x'.repeat(40);

describe('session tokens', () => {
  it('round-trips a Cyrillic name', async () => {
    const token = await createSessionToken('Иван Петров', secret, 1_000);
    expect(await readSessionToken(token, secret, 2_000)).toMatchObject({ name: 'Иван Петров' });
  });

  it('rejects a tampered payload', async () => {
    const token = await createSessionToken('Иван', secret);
    const [, signature] = token.split('.');
    const forged = btoa(JSON.stringify({ name: 'Admin', exp: Date.now() + 1e9 })).replace(/=+$/, '');
    expect(await readSessionToken(`${forged}.${signature}`, secret)).toBeNull();
  });

  it('rejects a token signed with another secret', async () => {
    const token = await createSessionToken('Иван', secret);
    expect(await readSessionToken(token, 'y'.repeat(40))).toBeNull();
  });

  it('expires', async () => {
    const token = await createSessionToken('Иван', secret, 0);
    expect(await readSessionToken(token, secret, 31 * 24 * 60 * 60 * 1000)).toBeNull();
  });

  it('handles missing and malformed tokens', async () => {
    expect(await readSessionToken(undefined, secret)).toBeNull();
    expect(await readSessionToken('garbage', secret)).toBeNull();
    expect(await readSessionToken('a.b', secret)).toBeNull();
  });
});

describe('passwordMatches', () => {
  it('compares exactly', () => {
    expect(passwordMatches('secret-pass', 'secret-pass')).toBe(true);
    expect(passwordMatches('secret-pas', 'secret-pass')).toBe(false);
    expect(passwordMatches('', 'secret-pass')).toBe(false);
  });
});
