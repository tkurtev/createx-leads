import { after, NextResponse } from 'next/server';
import { handleCallEnded } from '@/lib/agent/handle-call-ended';
import { parseVapiWebhook, verifyVapiSecret } from '@/lib/agent/providers/vapi';
import { errorResponse } from '@/lib/api';
import { getEnv } from '@/lib/env';
import { callReportEmail, leadUrl } from '@/lib/notify/messages';
import { sendWithResend } from '@/lib/notify/resend';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

/**
 * Where Vapi reports what happened on a call. Public by design: the shared
 * secret is the only thing that lets a request through.
 *
 * The lead's history is written before the response goes back, so a call is
 * never lost to a function that gets cut short. The email to the team can wait.
 */
export async function POST(request: Request) {
  try {
    const env = getEnv();
    if (!env.VAPI_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'VAPI_WEBHOOK_SECRET не е зададен.' }, { status: 503 });
    }

    const given =
      request.headers.get('x-vapi-secret') ??
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
      null;
    if (!verifyVapiSecret(given, env.VAPI_WEBHOOK_SECRET)) {
      return NextResponse.json({ error: 'Невалиден ключ.' }, { status: 401 });
    }

    const parsed = parseVapiWebhook(await request.json().catch(() => null));
    if (parsed.kind === 'ignored') {
      return NextResponse.json({ ok: true, ignored: parsed.reason });
    }

    const result = await handleCallEnded({ env, store: getStore(), call: parsed.call });

    if (result.status === 'unknown-lead') {
      // 200 on purpose: retrying will not make the lead appear, and Vapi should stop.
      console.error('[agent] call for an unknown lead', result.phone);
      return NextResponse.json({ ok: true, ignored: 'лийдът не беше намерен' });
    }
    if (result.status === 'duplicate') {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    if (env.RESEND_API_KEY && env.NOTIFY_EMAIL_TO.length > 0) {
      const url = leadUrl(env.APP_URL ?? new URL(request.url).origin, result.activity.leadId);
      const email = callReportEmail(
        { leadName: result.leadName, status: result.activity.status, call: result.activity.call! },
        url,
      );
      after(() =>
        sendWithResend(
          { apiKey: env.RESEND_API_KEY!, from: env.NOTIFY_EMAIL_FROM },
          { to: env.NOTIFY_EMAIL_TO, ...email },
        ).catch((error) => console.error('[agent] call report email failed', error)),
      );
    }

    return NextResponse.json({ ok: true, activityId: result.activity.id });
  } catch (error) {
    return errorResponse(error);
  }
}
