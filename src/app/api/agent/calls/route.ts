import { timingSafeEqual } from 'node:crypto';
import { after, NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse } from '@/lib/api';
import { getEnv } from '@/lib/env';
import { QUALIFICATIONS, STATUSES, type CallDetails, type CallTurn } from '@/lib/leads/types';
import { callReportEmail, leadUrl } from '@/lib/notify/messages';
import { sendWithResend } from '@/lib/notify/resend';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

const turnSchema = z.object({
  role: z.enum(['agent', 'lead']),
  text: z.string().trim().min(1),
  at: z.number().nonnegative().optional(),
});

const schema = z.object({
  leadId: z.string().min(1),
  leadName: z.string().trim().max(120).optional(),
  outcome: z.enum(STATUSES).optional(),
  summary: z.string().trim().min(1, 'summary е задължително').max(4000),
  /** Either a list of turns or the whole conversation as one block of text. */
  transcript: z.union([z.string().trim().max(50_000), z.array(turnSchema).max(2000)]).optional(),
  recordingUrl: z.string().url().optional(),
  durationSec: z.number().nonnegative().optional(),
  qualification: z.enum(QUALIFICATIONS).optional(),
  nextSteps: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  callbackAt: z.string().datetime().optional(),
  facts: z.array(z.object({ label: z.string().trim().min(1).max(60), value: z.string().trim().min(1).max(500) })).max(40).optional(),
  callId: z.string().max(200).optional(),
});

const SPEAKERS: [RegExp, CallTurn['role']][] = [
  [/^(агент|асистент|agent|assistant|ai|bot)\s*[:：]\s*/i, 'agent'],
  [/^(клиент|лийд|потребител|customer|client|user|lead)\s*[:：]\s*/i, 'lead'],
];

/** "Агент: Здравейте\nКлиент: Да?" becomes turns; anything else is left as plain text. */
export function parseTextTranscript(text: string): CallTurn[] {
  const turns: CallTurn[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = SPEAKERS.find(([pattern]) => pattern.test(trimmed));
    if (match) {
      turns.push({ role: match[1], text: trimmed.replace(match[0], '').trim() });
    } else if (turns.length > 0) {
      turns[turns.length - 1].text += `\n${trimmed}`;
    }
  }
  return turns.filter((turn) => turn.text !== '');
}

function authorized(header: string | null, key: string) {
  const given = Buffer.from(header?.replace(/^Bearer\s+/i, '') ?? '');
  const expected = Buffer.from(key);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** An agent running somewhere else posts the result of its call here. */
export async function POST(request: Request) {
  try {
    const env = getEnv();
    if (!env.AGENT_API_KEY) {
      return NextResponse.json(
        { error: 'AGENT_API_KEY не е зададен, приемането на обаждания е изключено.' },
        { status: 503 },
      );
    }
    if (!authorized(request.headers.get('authorization'), env.AGENT_API_KEY)) {
      return NextResponse.json({ error: 'Невалиден ключ.' }, { status: 401 });
    }

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json({ error: `${issue.path.join('.')}: ${issue.message}` }, { status: 400 });
    }
    const body = parsed.data;

    const turns = typeof body.transcript === 'string' ? parseTextTranscript(body.transcript) : (body.transcript ?? []);
    // Text that did not look like a conversation is kept verbatim rather than dropped.
    const unparsed = typeof body.transcript === 'string' && turns.length === 0 ? body.transcript : '';

    const call: CallDetails = {
      provider: 'external',
      state: 'ended',
      reached: body.outcome !== 'no_answer',
      summary: body.summary,
      qualification: body.qualification ?? 'unknown',
      transcript: turns,
      facts: body.facts ?? [],
      nextSteps: body.nextSteps ?? [],
      ...(body.callId ? { callId: body.callId } : {}),
      ...(body.recordingUrl ? { recordingUrl: body.recordingUrl } : {}),
      ...(body.durationSec === undefined ? {} : { durationSec: body.durationSec }),
      ...(body.callbackAt ? { callbackAt: body.callbackAt } : {}),
    };

    const store = getStore();
    const activity = await store.appendActivity({
      leadId: body.leadId,
      leadName: body.leadName,
      author: env.AGENT_NAME,
      type: 'call',
      text: [body.summary, unparsed ? `Транскрипция:\n${unparsed}` : ''].filter(Boolean).join('\n\n'),
      status: body.outcome,
      call,
    });

    if (env.RESEND_API_KEY && env.NOTIFY_EMAIL_TO.length > 0) {
      const url = leadUrl(env.APP_URL ?? new URL(request.url).origin, body.leadId);
      const email = callReportEmail({ leadName: body.leadName ?? 'лийд', status: body.outcome, call }, url);
      after(() =>
        sendWithResend(
          { apiKey: env.RESEND_API_KEY!, from: env.NOTIFY_EMAIL_FROM },
          { to: env.NOTIFY_EMAIL_TO, ...email },
        ).catch((error) => console.error('[agent] call report email failed', error)),
      );
    }

    return NextResponse.json({ ok: true, activityId: activity.id });
  } catch (error) {
    return errorResponse(error);
  }
}
