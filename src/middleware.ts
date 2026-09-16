import { NextResponse, type NextRequest } from 'next/server';
import { readSessionToken, SESSION_COOKIE } from '@/lib/auth/session';

export async function middleware(request: NextRequest) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    return new NextResponse('SESSION_SECRET не е зададен. Добавете го в настройките на хостинга.', { status: 500 });
  }
  const session = await readSessionToken(request.cookies.get(SESSION_COOKIE)?.value, secret);
  if (session) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Влезте отново.' }, { status: 401 });
  }
  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  // form, api/intake and api/agent are public: the form is for leads, the agent has its own key.
  matcher: ['/((?!login|form|api/login|api/intake|api/agent|_next/static|_next/image|favicon.ico|icon.svg|createx-logo.png).*)'],
};
