import { after, NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { dispatchNewLead } from '@/lib/intake/dispatch';
import { createRateLimiter } from '@/lib/intake/rate-limit';
import { intakeToRow } from '@/lib/intake/row';
import { intakeSchema } from '@/lib/intake/schema';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

const allow = createRateLimiter(5, 10 * 60_000);

/** Public: the lead form posts here. No login, so it reveals nothing about other leads. */
export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (!allow(ip)) {
    return NextResponse.json({ error: 'Твърде много опити. Опитайте отново след малко.' }, { status: 429 });
  }

  const parsed = intakeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    // A filled honeypot is a bot: pretend it worked so it doesn't retry.
    if (issue?.path[0] === 'website') return NextResponse.json({ ok: true });
    return NextResponse.json({ error: issue?.message ?? 'Проверете полетата.' }, { status: 400 });
  }

  try {
    const env = getEnv();
    const store = getStore();
    const [header = []] = await store.readLeadRows();
    const lead = parsed.data;
    const { row, id, createdAt } = intakeToRow(header, lead);
    await store.appendLeadRow(row);

    const appUrl = env.APP_URL ?? new URL(request.url).origin;
    after(() => dispatchNewLead({ env, store, lead, id, createdAt, appUrl }));

    return NextResponse.json({ ok: true, id, agentCalls: Boolean(env.AGENT_WEBHOOK_URL) });
  } catch (error) {
    console.error('[intake]', error);
    return NextResponse.json(
      { error: 'Запитването не беше записано. Моля, опитайте отново или ни се обадете.' },
      { status: 500 },
    );
  }
}
