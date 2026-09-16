import { describe, expect, it } from 'vitest';
import type { Env } from '@/lib/env';
import { sendLeadEmail } from './send';
import { emailRequestSchema } from './validation';

const email = { leadId: 'l1', to: 'lead@example.com', subject: 'Тема', body: 'Здравейте' };
const env = (transport: Env['EMAIL_TRANSPORT']) => ({ EMAIL_TRANSPORT: transport, SMTP_PORT: 465 }) as Env;

describe('sendLeadEmail', () => {
  it('refuses when sending is switched off, with a message the user can act on', async () => {
    await expect(sendLeadEmail(env('off'), email)).rejects.toThrow(/Отвори в пощата/);
  });

  it('builds but does not deliver in log mode', async () => {
    await expect(sendLeadEmail(env('log'), email)).resolves.toEqual({ delivered: false, transport: 'log' });
  });
});

describe('emailRequestSchema', () => {
  it('requires a subject and body', () => {
    const result = emailRequestSchema.safeParse({ ...email, subject: '  ', body: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a bad recipient', () => {
    expect(emailRequestSchema.safeParse({ ...email, to: 'nope' }).success).toBe(false);
  });
});
