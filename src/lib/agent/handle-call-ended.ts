import type { Env } from '@/lib/env';
import { normalizePhone } from '@/lib/leads/normalize';
import { parseLeads } from '@/lib/leads/parse';
import type { Activity, CallDetails, CallFact } from '@/lib/leads/types';
import type { LeadStore } from '@/lib/store/types';
import { analyzeCall } from './analyze';
import type { CallEnded } from './types';

type HandleEnv = Pick<Env, 'ANTHROPIC_API_KEY' | 'ANALYSIS_MODEL' | 'AGENT_NAME'>;

type Handle = {
  env: HandleEnv;
  store: LeadStore;
  call: CallEnded;
  now?: Date;
};

export type HandledCall =
  | { status: 'duplicate'; callId: string }
  | { status: 'unknown-lead'; phone?: string }
  | { status: 'recorded'; activity: Activity; leadName: string };

/** Fields the client configured in their calling platform win: they asked for exactly those. */
function mergeFacts(providerFacts: CallFact[], analysisFacts: CallFact[]): CallFact[] {
  const seen = new Set(providerFacts.map((fact) => fact.label.toLowerCase()));
  return [...providerFacts, ...analysisFacts.filter((fact) => !seen.has(fact.label.toLowerCase()))];
}

/** Metadata is the reliable route home; the dialled number is the fallback when it is missing. */
async function findLead(store: LeadStore, call: CallEnded): Promise<{ id: string; name: string } | null> {
  if (call.leadId) return { id: call.leadId, name: call.leadName ?? 'лийд' };
  const phone = call.phone ? normalizePhone(call.phone) : null;
  if (!phone) return null;
  const leads = parseLeads(await store.readLeadRows());
  const match = leads.find((lead) => lead.phone === phone);
  return match ? { id: match.id, name: match.name } : null;
}

async function alreadyRecorded(store: LeadStore, callId: string): Promise<boolean> {
  const activity = await store.readActivity();
  return activity.some((item) => item.call?.callId === callId && item.call.state === 'ended');
}

/**
 * Turns a finished call into one entry in the lead's history: what was said, how
 * it went and what to do next. Runs for the Vapi webhook and for the local test
 * provider alike.
 *
 * Nothing here may throw away a call that actually happened: if reading the
 * conversation fails, the transcript and the recording are still written down,
 * with the reason attached.
 */
export async function handleCallEnded({ env, store, call, now = new Date() }: Handle): Promise<HandledCall> {
  if (call.callId && (await alreadyRecorded(store, call.callId))) {
    return { status: 'duplicate', callId: call.callId };
  }

  const lead = await findLead(store, call);
  if (!lead) return { status: 'unknown-lead', ...(call.phone ? { phone: call.phone } : {}) };

  const base: CallDetails = {
    provider: call.provider,
    state: 'ended',
    reached: call.reached,
    ...(call.callId ? { callId: call.callId } : {}),
    ...(call.endedReason ? { endedReason: call.endedReason } : {}),
    ...(call.durationSec === undefined ? {} : { durationSec: call.durationSec }),
    ...(call.recordingUrl ? { recordingUrl: call.recordingUrl } : {}),
    ...(call.transcriptTrimmed ? { transcriptTrimmed: true } : {}),
    transcript: call.transcript,
    facts: call.providerFacts,
  };

  // Nobody picked up: there is nothing to read, and the lead goes back in the call list.
  if (!call.reached) {
    const summary = call.endedExplanation ?? 'Никой не отговори на обаждането.';
    const activity = await store.appendActivity({
      leadId: lead.id,
      leadName: lead.name,
      author: env.AGENT_NAME,
      type: 'call',
      text: summary,
      status: 'no_answer',
      call: { ...base, summary, qualification: 'unknown' },
    });
    return { status: 'recorded', activity, leadName: lead.name };
  }

  let details: CallDetails = {
    ...base,
    summary: call.providerSummary ?? 'Разговорът се проведе, но няма обобщение.',
    qualification: 'unknown',
  };
  let status: Activity['status'] = 'in_progress';
  let note = '';

  if (env.ANTHROPIC_API_KEY) {
    try {
      const analysis = await analyzeCall(
        {
          transcript: call.transcript,
          lead: { name: lead.name },
          ...(call.providerSummary ? { providerSummary: call.providerSummary } : {}),
          now,
        },
        { apiKey: env.ANTHROPIC_API_KEY, model: env.ANALYSIS_MODEL },
      );
      status = analysis.outcome;
      details = {
        ...details,
        summary: analysis.summary,
        qualification: analysis.qualification,
        nextSteps: analysis.nextSteps,
        ...(analysis.callbackAt ? { callbackAt: analysis.callbackAt } : {}),
        facts: mergeFacts(call.providerFacts, analysis.facts),
      };
    } catch (error) {
      // The conversation is the valuable part; losing the reading of it is survivable.
      note = `\n\n(Разговорът не можа да бъде анализиран: ${error instanceof Error ? error.message : String(error)})`;
      console.error('[agent] call analysis failed', error);
    }
  }

  const activity = await store.appendActivity({
    leadId: lead.id,
    leadName: lead.name,
    author: env.AGENT_NAME,
    type: 'call',
    text: `${details.summary ?? ''}${note}`.trim(),
    status,
    call: details,
  });
  return { status: 'recorded', activity, leadName: lead.name };
}
