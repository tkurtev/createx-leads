import { NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse } from '@/lib/api';
import { createSessionToken, passwordMatches, SESSION_COOKIE, SESSION_DAYS } from '@/lib/auth/session';
import { getEnv } from '@/lib/env';

const schema = z.object({
  name: z.string().trim().min(2, 'Напишете името си').max(60),
  password: z.string().min(1, 'Въведете паролата'),
});

export async function POST(request: Request) {
  try {
    const env = getEnv();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    if (!passwordMatches(parsed.data.password, env.APP_PASSWORD)) {
      return NextResponse.json({ error: 'Грешна парола.' }, { status: 401 });
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, await createSessionToken(parsed.data.name, env.SESSION_SECRET), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_DAYS * 24 * 60 * 60,
      path: '/',
    });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
