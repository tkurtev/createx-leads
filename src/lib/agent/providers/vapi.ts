import { timingSafeEqual } from 'node:crypto';
import { humanize } from '@/lib/leads/normalize';
import type { CallFact, CallTurn } from '@/lib/leads/types';
import type { CallEnded, CallProvider, CallTarget, ParsedWebhook, PlacedCall } from '../types';

const API = 'https://api.vapi.ai/call';

export type VapiConfig = {
  apiKey: string;
  assistantId: string;
  phoneNumberId: string;
  /** Shared secret Vapi sends back on its webhooks. */
  webhookSecret?: string;
};

/**
 * Reasons that mean the phone rang into nothing. Everything else is judged by
 * whether the lead actually said something, which is provider independent.
 */
const UNANSWERED = new Set([
  'customer-did-not-answer',
  'customer-busy',
  'voicemail',
  'assistant-join-timed-out',
  'twilio-failed-to-connect-call',
  'vonage-failed-to-connect-call',
  'vonage-rejected',
  'phone-call-provider-bypass-enabled-but-no-call-received',
  'phone-call-provider-closed-websocket',
  'customer-did-not-give-microphone-permission',
  'call.in-progress.error-sip-outbound-call-failed-to-connect',
]);

/** Plain Bulgarian for the endings a salesperson will actually see. */
const REASONS: Record<string, string> = {
  'customer-did-not-answer': 'Клиентът не вдигна',
  'customer-busy': 'Линията беше заета',
  voicemail: 'Включи се гласова поща',
  'customer-ended-call': 'Клиентът затвори',
  'assistant-ended-call': 'Агентът приключи разговора',
  'assistant-ended-call-after-message-spoken': 'Агентът приключи разговора',
  'assistant-said-end-call-phrase': 'Агентът приключи разговора',
  'assistant-forwarded-call': 'Разговорът беше прехвърлен',
  'silence-timed-out': 'Разговорът прекъсна заради мълчание',
  'exceeded-max-duration': 'Разговорът достигна максималната дължина',
  'assistant-join-timed-out': 'Агентът не успя да се включи',
  'twilio-failed-to-connect-call': 'Връзката не се осъществи',
  'vonage-failed-to-connect-call': 'Връзката не се осъществи',
  'vonage-rejected': 'Обаждането беше отхвърлено',
};

export function describeEndedReason(reason?: string): string | undefined {
  if (!reason) return undefined;
  return REASONS[reason] ?? undefined;
}

/** Long calls would not fit a spreadsheet cell; the end of the conversation is what matters. */
const MAX_TRANSCRIPT_CHARS = 20_000;

function trimTranscript(turns: CallTurn[]): { turns: CallTurn[]; trimmed: boolean } {
  let total = turns.reduce((sum, t) => sum + t.text.length, 0);
  if (total <= MAX_TRANSCRIPT_CHARS) return { turns, trimmed: false };
  const kept = [...turns];
  while (kept.length > 0 && total > MAX_TRANSCRIPT_CHARS) {
    total -= kept.shift()!.text.length;
  }
  return { turns: kept, trimmed: true };
}

type VapiMessage = { role?: unknown; message?: unknown; secondsFromStart?: unknown };

/** Vapi keeps system prompts and tool traffic in the same list; only speech belongs in a transcript. */
export function toTranscript(messages: unknown): CallTurn[] {
  if (!Array.isArray(messages)) return [];
  const turns: CallTurn[] = [];
  for (const raw of messages as VapiMessage[]) {
    const role = raw?.role === 'user' ? 'lead' : raw?.role === 'bot' ? 'agent' : null;
    if (!role) continue;
    const text = typeof raw.message === 'string' ? raw.message.trim() : '';
    if (!text) continue;
    const at = typeof raw.secondsFromStart === 'number' ? Math.round(raw.secondsFromStart) : undefined;
    turns.push({ role, text, ...(at === undefined ? {} : { at }) });
  }
  return turns;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'да' : 'не';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.map(formatValue).filter(Boolean).join(', ');
  return JSON.stringify(value);
}

/** "budgetRange" -> "budget range", so a camelCase field name reads like a label. */
const splitCamelCase = (key: string) => key.replace(/([a-z\d])([A-Z])/g, (_, a: string, b: string) => `${a} ${b.toLowerCase()}`);

/**
 * Whatever the assistant was configured to extract in Vapi, shown as it comes.
 * The app deliberately knows nothing about which fields a given business uses.
 */
export function toFacts(structuredData: unknown): CallFact[] {
  if (!structuredData || typeof structuredData !== 'object' || Array.isArray(structuredData)) return [];
  return Object.entries(structuredData as Record<string, unknown>)
    .map(([key, value]) => ({ label: humanize(splitCamelCase(key)), value: formatValue(value) }))
    .filter((fact) => fact.label !== '' && fact.value !== '');
}

function seconds(startedAt: unknown, endedAt: unknown): number | undefined {
  if (typeof startedAt !== 'string' || typeof endedAt !== 'string') return undefined;
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 1000) : undefined;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

/**
 * Reads an "end-of-call-report" webhook. Everything is treated as untrusted:
 * a missing or renamed field must never lose a call that actually happened.
 */
export function parseVapiWebhook(body: unknown): ParsedWebhook {
  const message = asRecord(asRecord(body).message);
  const type = asString(message.type);
  if (!type) return { kind: 'ignored', reason: 'без тип на съобщението' };
  if (type !== 'end-of-call-report') return { kind: 'ignored', reason: type };

  const call = asRecord(message.call);
  const artifact = asRecord(message.artifact);
  const analysis = asRecord(message.analysis);
  const metadata = asRecord(asRecord(call.assistantOverrides).metadata);
  const endedReason = asString(message.endedReason) ?? asString(call.endedReason);

  const { turns, trimmed } = trimTranscript(toTranscript(artifact.messages));
  const spoke = turns.some((turn) => turn.role === 'lead');

  const ended: CallEnded = {
    provider: 'vapi',
    callId: asString(call.id),
    leadId: asString(metadata.leadId) ?? null,
    leadName: asString(metadata.leadName),
    phone: asString(asRecord(message.customer).number) ?? asString(asRecord(call.customer).number),
    reached: endedReason && UNANSWERED.has(endedReason) ? false : spoke,
    endedReason,
    endedExplanation: describeEndedReason(endedReason),
    durationSec: seconds(message.startedAt ?? call.startedAt, message.endedAt ?? call.endedAt),
    recordingUrl: asString(artifact.recordingUrl) ?? asString(artifact.stereoRecordingUrl),
    transcript: turns,
    ...(trimmed ? { transcriptTrimmed: true } : {}),
    providerSummary: asString(analysis.summary),
    providerFacts: toFacts(analysis.structuredData),
  };
  return { kind: 'call-ended', call: ended };
}

/** Constant time, so a wrong secret tells an attacker nothing about the right one. */
export function verifyVapiSecret(given: string | null, expected: string): boolean {
  const a = Buffer.from(given ?? '');
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createVapiProvider(config: VapiConfig, fetchImpl: typeof fetch = fetch): CallProvider {
  return {
    name: 'vapi',
    async placeCall(target: CallTarget): Promise<PlacedCall> {
      const response = await fetchImpl(API, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assistantId: config.assistantId,
          phoneNumberId: config.phoneNumberId,
          // Shown in the Vapi dashboard, so a call can be found from the lead and back.
          name: `${target.name} (${target.leadId})`,
          customer: {
            number: target.phone,
            name: target.name,
            ...(target.email ? { email: target.email } : {}),
          },
          assistantOverrides: {
            // Comes back on the webhook, which is how a call finds its lead again.
            metadata: { leadId: target.leadId, leadName: target.name, source: target.source, app: 'createx-leads' },
            // The prompt in the Vapi dashboard fills these in with {{name}}, {{interest}} and so on.
            variableValues: {
              name: target.name,
              firstName: target.name.trim().split(/\s+/)[0] ?? target.name,
              phone: target.phone,
              email: target.email ?? '',
              interest: target.interest,
              message: target.message,
              source: target.source,
            },
          },
        }),
        signal: AbortSignal.timeout(15_000),
      });

      const body = (await response.json().catch(() => ({}))) as { id?: string; message?: unknown };
      if (!response.ok) {
        const detail = typeof body.message === 'string' ? body.message : JSON.stringify(body).slice(0, 200);
        throw new Error(`Vapi отказа обаждането (${response.status}): ${detail || 'без обяснение'}`);
      }
      return { provider: 'vapi', callId: body.id };
    },
  };
}
