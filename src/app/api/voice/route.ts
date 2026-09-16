import { NextResponse } from 'next/server';
import { errorResponse } from '@/lib/api';
import { extensionFor, voiceUploadProblem } from '@/lib/audio/validation';
import { getSession } from '@/lib/auth/server';
import { getAudioStore, getStore } from '@/lib/store';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Влезте отново.' }, { status: 401 });

    const audioStore = getAudioStore();
    if (!audioStore) {
      return NextResponse.json({ error: 'Гласовите бележки не са включени (липсва папка в Google Drive).' }, { status: 503 });
    }

    const form = await request.formData();
    const file = form.get('audio');
    const leadId = String(form.get('leadId') ?? '');
    const leadName = String(form.get('leadName') ?? '');
    const durationSec = Number(form.get('durationSec'));
    if (!(file instanceof Blob) || !leadId) {
      return NextResponse.json({ error: 'Липсва запис.' }, { status: 400 });
    }

    const problem = voiceUploadProblem({ size: file.size, type: file.type, durationSec });
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = leadName.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 60) || leadId;
    const audioId = await audioStore.save(
      Buffer.from(await file.arrayBuffer()),
      file.type,
      `${stamp} ${safeName}.${extensionFor(file.type)}`,
    );

    const activity = await getStore().appendActivity({
      leadId,
      leadName,
      author: session.name,
      type: 'voice',
      text: '',
      audio: { id: audioId, durationSec: Math.round(durationSec * 10) / 10, mime: file.type },
    });
    return NextResponse.json({ activity });
  } catch (error) {
    return errorResponse(error);
  }
}
