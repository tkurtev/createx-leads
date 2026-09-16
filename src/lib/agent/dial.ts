import type { Activity } from '@/lib/leads/types';
import type { LeadStore } from '@/lib/store/types';
import type { CallEnded, CallProvider, CallTarget } from './types';

type Dial = {
  store: LeadStore;
  provider: CallProvider;
  target: CallTarget;
  /** Shown as the author of the note in the lead's history. */
  agentName: string;
};

export type DialResult = { activity: Activity; simulated?: CallEnded };

/**
 * Hands a lead to the calling agent and writes that down straight away, so the
 * team can see a call is on its way. The result of the call arrives later, on
 * the provider's webhook.
 */
export async function startAgentCall({ store, provider, target, agentName }: Dial): Promise<DialResult> {
  const placed = await provider.placeCall(target);
  const activity = await store.appendActivity({
    leadId: target.leadId,
    leadName: target.name,
    author: agentName,
    type: 'call',
    text: 'Обаждането е насрочено. Резултатът ще се появи тук веднага след разговора.',
    call: { provider: placed.provider, state: 'queued', ...(placed.callId ? { callId: placed.callId } : {}) },
  });
  return { activity, ...(placed.simulated ? { simulated: placed.simulated } : {}) };
}
