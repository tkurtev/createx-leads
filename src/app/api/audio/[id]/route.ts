import { NextResponse } from 'next/server';
import { errorResponse } from '@/lib/api';
import { parseRange } from '@/lib/audio/validation';
import { getSession } from '@/lib/auth/server';
import { getAudioStore } from '@/lib/store';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await getSession())) return NextResponse.json({ error: 'Влезте отново.' }, { status: 401 });
    const store = getAudioStore();
    if (!store) return NextResponse.json({ error: 'Гласовите бележки не са включени.' }, { status: 503 });

    const audio = await store.read((await params).id);
    if (!audio) return NextResponse.json({ error: 'Записът не е намерен.' }, { status: 404 });

    const size = audio.data.length;
    const headers = {
      'Content-Type': audio.mime,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600',
    };
    const range = parseRange(request.headers.get('range'), size);
    if (range) {
      return new Response(new Uint8Array(audio.data.subarray(range.start, range.end + 1)), {
        status: 206,
        headers: {
          ...headers,
          'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
          'Content-Length': String(range.end - range.start + 1),
        },
      });
    }
    return new Response(new Uint8Array(audio.data), { headers: { ...headers, 'Content-Length': String(size) } });
  } catch (error) {
    return errorResponse(error);
  }
}
