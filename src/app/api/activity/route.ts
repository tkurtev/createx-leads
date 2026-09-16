import { NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse } from '@/lib/api';
import { getSession } from '@/lib/auth/server';
import { STATUSES } from '@/lib/leads/types';
import { getStore } from '@/lib/store';

const schema = z
  .object({
    leadId: z.string().min(1),
    leadName: z.string().optional(),
    type: z.enum(['comment', 'call', 'status']),
    text: z.string().trim().max(5000).default(''),
    status: z.enum(STATUSES).optional(),
  })
  .refine((a) => a.type !== 'comment' || a.text.length > 0, { message: 'Коментарът е празен', path: ['text'] })
  .refine((a) => a.type !== 'status' || a.status, { message: 'Изберете статус', path: ['status'] });

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Влезте отново.' }, { status: 401 });

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const activity = await getStore().appendActivity({ ...parsed.data, author: session.name });
    return NextResponse.json({ activity });
  } catch (error) {
    return errorResponse(error);
  }
}
