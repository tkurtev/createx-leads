import { NextResponse } from 'next/server';

export function errorResponse(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : 'Нещо се обърка.';
  console.error('[api]', message);
  return NextResponse.json({ error: message }, { status });
}
