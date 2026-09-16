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
  AGENT_NAME: 'AI агент',
};

function setup(fetchImpl: typeof fetch, env: Record<string, unknown> = baseEnv) {
  const store = { appendActivity: vi.fn(async (a) => a) } as unknown as LeadStore;
  const run = () =>
    dispatchNewLead({
      env: env as Parameters<typeof dispatchNewLead>[0]['env'],
      store,
      lead,
      id: 'l_1',
      createdAt: '2026-09-16T12:00:00.000Z',
      appUrl: 'https://app.test/',
      fetchImpl,
    });
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
      RESEND_API_KEY: undefined,
      AGENT_WEBHOOK_URL: undefined,
    });
    expect(await run()).toEqual({ sent: 0, problems: [] });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('dispatchNewLead with a calling provider', () => {
  const vapiEnv = {
    ...baseEnv,
    RESEND_API_KEY: undefined,
    AGENT_WEBHOOK_URL: undefined,
    CALL_PROVIDER: 'vapi',
    VAPI_API_KEY: 'vapi_key',
    VAPI_ASSISTANT_ID: 'asst_1',
    VAPI_PHONE_NUMBER_ID: 'num_1',
  };

  it('places the call through Vapi and notes it on the lead', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: 'call_1' }), { status: 200 }));
    const { store, run } = setup(fetchImpl as unknown as typeof fetch, vapiEnv);

    expect(await run()).toMatchObject({ sent: 1, problems: [] });

    const [[url, init]] = fetchImpl.mock.calls as unknown as [string, RequestInit][];
    expect(url).toBe('https://api.vapi.ai/call');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer vapi_key' });
    expect(JSON.parse(String(init.body))).toMatchObject({
      assistantId: 'asst_1',
      phoneNumberId: 'num_1',
      customer: { number: '+359888123456', name: 'Иван' },
      assistantOverrides: {
        metadata: { leadId: 'l_1', leadName: 'Иван', source: 'harmony' },
        variableValues: { name: 'Иван', firstName: 'Иван', source: 'harmony' },
      },
    });

    expect(store.appendActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: 'l_1',
        author: 'AI агент',
        type: 'call',
        call: { provider: 'vapi', state: 'queued', callId: 'call_1' },
      }),
    );
  });

  it('tells the team in the lead history when Vapi refuses', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ message: 'no credits' }), { status: 402 }));
    const { store, run } = setup(fetchImpl as unknown as typeof fetch, vapiEnv);

    const result = await run();
    expect(result.problems[0]).toMatch(/Vapi отказа обаждането \(402\): no credits/);
    expect(store.appendActivity).toHaveBeenCalledWith(
      expect.objectContaining({ author: 'Система', type: 'comment', text: expect.stringMatching(/не успя да звънне/) }),
    );
  });

  it('never posts to the webhook agent once a provider places the calls', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: 'call_1' }), { status: 200 }));
    const { run } = setup(fetchImpl as unknown as typeof fetch, { ...vapiEnv, AGENT_WEBHOOK_URL: 'https://agent.example.com/hook' });
    await run();
    const calls = fetchImpl.mock.calls as unknown as [string, RequestInit][];
    expect(calls.every(([url]) => url.includes('vapi'))).toBe(true);
  });

  it('hands back a simulated conversation in local test mode', async () => {
    const fetchImpl = vi.fn();
    const { run } = setup(fetchImpl as unknown as typeof fetch, {
      ...baseEnv,
      RESEND_API_KEY: undefined,
      AGENT_WEBHOOK_URL: undefined,
      CALL_PROVIDER: 'log',
    });
    const result = await run();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.simulated).toMatchObject({ provider: 'log', leadId: 'l_1', reached: true });
  });
});
