import type { Env } from '@/lib/env';
import { createLogProvider } from './providers/log';
import { createVapiProvider } from './providers/vapi';
import type { CallProvider } from './types';

export type CallMode = 'off' | 'vapi' | 'webhook' | 'log';

type ProviderEnv = Pick<
  Env,
  'CALL_PROVIDER' | 'AGENT_WEBHOOK_URL' | 'VAPI_API_KEY' | 'VAPI_ASSISTANT_ID' | 'VAPI_PHONE_NUMBER_ID'
>;

/** Unset means "keep doing what this deployment already did": hand off to the webhook agent, or nothing. */
export function callMode(env: ProviderEnv): CallMode {
  if (env.CALL_PROVIDER) return env.CALL_PROVIDER;
  return env.AGENT_WEBHOOK_URL ? 'webhook' : 'off';
}

/** Null when this app does not place the calls itself. */
export function getCallProvider(env: ProviderEnv, fetchImpl: typeof fetch = fetch): CallProvider | null {
  switch (callMode(env)) {
    case 'vapi':
      return createVapiProvider(
        {
          apiKey: env.VAPI_API_KEY!,
          assistantId: env.VAPI_ASSISTANT_ID!,
          phoneNumberId: env.VAPI_PHONE_NUMBER_ID!,
        },
        fetchImpl,
      );
    case 'log':
      return createLogProvider();
    default:
      return null;
  }
}

/** Whether a lead who fills in the form gets called back automatically, by us or by someone else. */
export function agentCallsEnabled(env: ProviderEnv): boolean {
  return callMode(env) !== 'off';
}
