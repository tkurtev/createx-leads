import { describe, expect, it } from 'vitest';
import type { Env } from '@/lib/env';
import { agentCallsEnabled, callMode, getCallProvider } from './provider';

const env = (overrides: Partial<Env> = {}) =>
  ({
    CALL_PROVIDER: undefined,
    AGENT_WEBHOOK_URL: undefined,
    VAPI_API_KEY: 'vapi_key',
    VAPI_ASSISTANT_ID: 'asst_1',
    VAPI_PHONE_NUMBER_ID: 'num_1',
    ...overrides,
  }) as Env;

describe('who calls a new lead', () => {
  // The rollout depends on this: shipping the code without touching the settings
  // must leave an existing deployment doing exactly what it did before.
  it('keeps handing leads to an existing webhook agent when nothing is configured', () => {
    const existing = env({ AGENT_WEBHOOK_URL: 'https://agent.example.com/hook' });
    expect(callMode(existing)).toBe('webhook');
    expect(getCallProvider(existing)).toBeNull();
    expect(agentCallsEnabled(existing)).toBe(true);
  });

  it('calls nobody when nothing is configured at all', () => {
    expect(callMode(env())).toBe('off');
    expect(getCallProvider(env())).toBeNull();
    expect(agentCallsEnabled(env())).toBe(false);
  });

  it('takes over from the webhook agent once Vapi is switched on', () => {
    const chosen = env({ CALL_PROVIDER: 'vapi', AGENT_WEBHOOK_URL: 'https://agent.example.com/hook' });
    expect(callMode(chosen)).toBe('vapi');
    expect(getCallProvider(chosen)?.name).toBe('vapi');
  });

  it('can be switched off explicitly even with a webhook still configured', () => {
    const off = env({ CALL_PROVIDER: 'off', AGENT_WEBHOOK_URL: 'https://agent.example.com/hook' });
    expect(callMode(off)).toBe('off');
    expect(agentCallsEnabled(off)).toBe(false);
  });

  it('uses the local test provider without touching the network', () => {
    expect(getCallProvider(env({ CALL_PROVIDER: 'log' }))?.name).toBe('log');
  });
});
