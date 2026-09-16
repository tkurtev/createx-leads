import { timingSafeEqual } from 'node:crypto';
import { after, NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse } from '@/lib/api';
import { getEnv } from '@/lib/env';
import { STATUSES } from '@/lib/leads/types';
import { callReportEmail, leadUrl } from '@/lib/notify/messages';
import { sendWithResend } from '@/lib/notify/resend';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

const schema = z.object({
  leadId: z.string().min(1),
  leadName: z.string().trim().max(120).optional(),
  outcome: z.enum(STATUSES).optional(),
  summary: z.string().trim().min(1, 'summary е задължително').max(4000),
  transcript: z.string().trim().max(50_000).optional(),
  recordingUrl: z.string().url().optional(),
  durationSec: z.number().nonnegative().optional(),
});

function authorized(header: string | null, key: string) {
  const given = Buffer.from(header?.replace(/^Bearer\s+/i, '') ?? '');
  const expected = Buffer.from(key);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** The AI agent posts the result of a call here: it lands in the lead's history and the team gets an email. */
export async function POST(request: Request) {
  try {
    const env = getEnv();
    if (!env.AGENT_API_KEY) {
      return NextResponse.json({ error: 'AGENT_API_KEY не е зададен, приемането на обаждания е изключено.' }, { status: 503 });
    }
    if (!authorized(request.headers.get('authorization'), env.AGENT_API_KEY)) {
      return NextResponse.json({ error: 'Невалиден ключ.' }, { status: 401 });
    }

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json({ error: `${issue.path.join('.')}: ${issue.message}` }, { status: 400 });
    }
    const call = parsed.data;
    const text = [
      call.summary,
      call.recordingUrl ? `Запис: ${call.recordingUrl}` : '',
      call.transcript ? `Транскрипция:\n${call.transcript}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const store = getStore();
    const activity = await store.appendActivity({
      leadId: call.leadId,
      leadName: call.leadName,
      author: env.AGENT_NAME,
      type: 'call',
      text,
      status: call.outcome,
    });

    if (env.RESEND_API_KEY && env.NOTIFY_EMAIL_TO.length > 0) {
      const url = leadUrl(env.APP_URL ?? new URL(request.url).origin, call.leadId);
      const email = callReportEmail({ ...call, leadName: call.leadName ?? 'лийд' }, url);
      after(() =>
        sendWithResend({ apiKey: env.RESEND_API_KEY!, from: env.NOTIFY_EMAIL_FROM }, { to: env.NOTIFY_EMAIL_TO, ...email }).catch(
          (error) => console.error('[agent] call report email failed', error),
        ),
      );
    }

    return NextResponse.json({ ok: true, activityId: activity.id });
  } catch (error) {
    return errorResponse(error);
  }
}
