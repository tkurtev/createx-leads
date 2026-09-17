import { afterEach, describe, expect, it, vi } from 'vitest';

/** Enough to get past the checks that have nothing to do with calling. */
const BASE: Record<string, string | undefined> = {
  DATA_SOURCE: 'file',
  APP_PASSWORD: 'demo-password',
  SESSION_SECRET: 'x'.repeat(32),
  CALL_PROVIDER: undefined,
  AGENT_WEBHOOK_URL: undefined,
  VAPI_API_KEY: undefined,
  VAPI_ASSISTANT_ID: undefined,
  VAPI_PHONE_NUMBER_ID: undefined,
  VAPI_WEBHOOK_SECRET: undefined,
  RESEND_API_KEY: undefined,
  EMAIL_TRANSPORT: undefined,
};

/** getEnv caches, so every case needs a fresh copy of the module. */
async function load(overrides: Record<string, string | undefined> = {}) {
  vi.resetModules();
  for (const [key, value] of Object.entries({ ...BASE, ...overrides })) vi.stubEnv(key, value);
  return (await import('./env')).getEnv;
}

const VAPI = {
  CALL_PROVIDER: 'vapi',
  VAPI_API_KEY: 'vapi_key',
  VAPI_ASSISTANT_ID: 'asst_1',
  VAPI_PHONE_NUMBER_ID: 'num_1',
  VAPI_WEBHOOK_SECRET: 's'.repeat(24),
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('settings for the calling agent', () => {
  it('accepts a complete Vapi setup', async () => {
    const env = (await load(VAPI))();
    expect(env.CALL_PROVIDER).toBe('vapi');
    expect(env.ANALYSIS_MODEL).toBe('claude-opus-5');
    expect(env.AGENT_NAME).toBe('AI агент');
  });

  it.each(['VAPI_API_KEY', 'VAPI_ASSISTANT_ID', 'VAPI_PHONE_NUMBER_ID', 'VAPI_WEBHOOK_SECRET'])(
    'refuses to start without %s, instead of failing later on a real call',
    async (missing) => {
      const getEnv = await load({ ...VAPI, [missing]: undefined });
      expect(getEnv).toThrow(new RegExp(missing));
    },
  );

  it('asks where to send the lead when the webhook agent is chosen without a url', async () => {
    const getEnv = await load({ CALL_PROVIDER: 'webhook' });
    expect(getEnv).toThrow(/AGENT_WEBHOOK_URL/);
  });

  it('needs nothing extra when nobody calls automatically', async () => {
    const env = (await load())();
    expect(env.CALL_PROVIDER).toBeUndefined();
  });
});
