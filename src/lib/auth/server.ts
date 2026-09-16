import { cookies } from 'next/headers';
import { getEnv } from '@/lib/env';
import { readSessionToken, SESSION_COOKIE } from './session';

export async function getSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return readSessionToken(token, getEnv().SESSION_SECRET);
}
