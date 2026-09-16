import { describe, expect, it, vi } from 'vitest';
import type { LeadStore } from '@/lib/store/types';
import { dispatchNewLead } from './dispatch';
import { intakeSchema } from './schema';

const lead = intakeSchema.parse({ name: 'Иван', phone: '0888123456', consent: true, source: 'harmony' });
const baseEnv = {
  RESEND_API_KEY: 're_test',
  NOTIFY_EMAIL_TO: ['team@example.com'],
  NOTIFY_EMAIL_FROM: 'Leads <onboarding@resend.dev>',
  AGENT_WEBHOOK_URL: 'https://agent.example.com/hook',
  AGENT_WEBHOOK_SECRET: 'shh',
};

function setup(fetchImpl: typeof fetch, env = baseEnv) {
  const store = { appendActivity: vi.fn(async () => ({})) } as unknown as LeadStore;
  const run = () =>
    dispatchNewLead({ env, store, lead, id: 'l_1', createdAt: '2026-09-16T12:00:00.000Z', appUrl: 'https://app.test/', fetchImpl });
  return { store, run };
}

describe('dispatchNewLead', () => {
  it('emails the team and hands the lead to the agent with a callback url', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: 'e1' }), { status: 200 }));
    const { store, run } = setup(fetchImpl as unknown as typeof fetch);

    expect(await run()).toEqual({ sent: 2, problems: [] });
    expect(store.appendActivity).not.toHaveBeenCalled();

    const calls = fetchImpl.mock.calls as unknown as [string, RequestInit][];
    const email = calls.find(([url]) => url.includes('resend'))!;
    expect(JSON.parse(String(email[1].body))).toMatchObject({
      to: ['team@example.com'],
      subject: 'Нов лийд: Иван (+359 88 812 3456)',
    });
    expect(String(JSON.parse(String(email[1].body)).html)).toContain('https://app.test/?lead=l_1');

    const hook = calls.find(([url]) => url.includes('agent'))!;
    expect(hook[1].headers).toMatchObject({ Authorization: 'Bearer shh' });
    expect(JSON.parse(String(hook[1].body))).toMatchObject({
      event: 'lead.created',
      lead: { id: 'l_1', phone: '+359888123456', source: 'harmony' },
      callbackUrl: 'https://app.test/api/agent/calls',
    });
  });

  it('writes each failure to the lead history so the team sees it', async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url.includes('resend')
        ? new Response(JSON.stringify({ message: 'domain not verified' }), { status: 403 })
        : new Response('ok', { status: 200 }),
    );
    const { store, run } = setup(fetchImpl as unknown as typeof fetch);

    const result = await run();
    expect(result.sent).toBe(1);
    expect(result.problems[0]).toMatch(/domain not verified/);
    expect(store.appendActivity).toHaveBeenCalledWith(
      expect.objectContaining({ leadId: 'l_1', author: 'Система', type: 'comment', text: expect.stringMatching(/Resend/) }),
    );
  });

  it('does nothing when neither email nor agent is configured', async () => {
    const fetchImpl = vi.fn();
    const { run } = setup(fetchImpl as unknown as typeof fetch, {
      ...baseEnv,
      RESEND_API_KEY: undefined as unknown as string,
      AGENT_WEBHOOK_URL: undefined as unknown as string,
    });
    expect(await run()).toEqual({ sent: 0, problems: [] });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
