import { NextResponse } from 'next/server';
import { errorResponse } from '@/lib/api';
import { getSession } from '@/lib/auth/server';
import { sendLeadEmail } from '@/lib/email/send';
import { emailRequestSchema } from '@/lib/email/validation';
import { getEnv } from '@/lib/env';
import { getStore } from '@/lib/store';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Влезте отново.' }, { status: 401 });

    const parsed = emailRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const env = getEnv();
    const result = await sendLeadEmail(env, parsed.data);
    const activity = await getStore().appendActivity({
      leadId: parsed.data.leadId,
      leadName: parsed.data.leadName,
      author: session.name,
      type: 'email',
      text: `${result.delivered ? '' : '[тест, не е изпратен] '}${parsed.data.subject}\n\n${parsed.data.body}`,
    });
    return NextResponse.json({ activity, delivered: result.delivered });
  } catch (error) {
    return errorResponse(error);
  }
}
