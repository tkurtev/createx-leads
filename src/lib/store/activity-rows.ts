import { ACTIVITY_TYPES, STATUSES, type Activity, type CallDetails } from '@/lib/leads/types';
import type { NewActivity } from './types';

/** Column order of the activity tab. Human readable on purpose: the team can read it in Sheets. */
export const ACTIVITY_HEADER = [
  'ID',
  'Lead ID',
  'Кога',
  'Кой',
  'Тип',
  'Статус',
  'Текст',
  'Лийд',
  'Аудио файл',
  'Секунди',
  'Формат',
  'Данни',
];

export const ACTIVITY_COLUMNS = `A:${String.fromCharCode(64 + ACTIVITY_HEADER.length)}`;

/**
 * A Google Sheets cell holds 50 000 characters. Transcripts are the only part of
 * a call that has no natural length, so leave room and trim them rather than
 * lose the whole row to a rejected write.
 */
const MAX_DATA_CELL = 45_000;

/** Keeps the end of the conversation: what was agreed matters more than the greeting. */
export function serializeCall(call: CallDetails): string {
  const json = JSON.stringify(call);
  if (json.length <= MAX_DATA_CELL) return json;

  const turns = [...(call.transcript ?? [])];
  while (turns.length > 0) {
    turns.shift();
    const shorter = JSON.stringify({ ...call, transcript: turns, transcriptTrimmed: true });
    if (shorter.length <= MAX_DATA_CELL) return shorter;
  }
  // Even without the transcript it does not fit: keep the parts a person reads first.
  const { summary, nextSteps, qualification, ...rest } = call;
  return JSON.stringify({ ...rest, summary, nextSteps, qualification, transcript: [], transcriptTrimmed: true }).slice(
    0,
    MAX_DATA_CELL,
  );
}

/** Anything unreadable is dropped: a garbled cell must not hide the rest of the row. */
export function parseCall(value: string): CallDetails | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const call = parsed as CallDetails;
    if (typeof call.provider !== 'string' || typeof call.state !== 'string') return null;
    return call;
  } catch {
    return null;
  }
}

export function activityToRow(activity: Activity, leadName = ''): string[] {
  return [
    activity.id,
    activity.leadId,
    activity.at,
    activity.author,
    activity.type,
    activity.status ?? '',
    activity.text,
    leadName,
    activity.audio?.id ?? '',
    activity.audio ? String(activity.audio.durationSec) : '',
    activity.audio?.mime ?? '',
    activity.call ? serializeCall(activity.call) : '',
  ];
}

export function rowToActivity(row: string[]): Activity | null {
  const [id, leadId, at, author, type, status, text, , audioId, seconds, mime, data] = row.map((v) => v ?? '');
  if (!id || !leadId || !at) return null;
  if (!(ACTIVITY_TYPES as readonly string[]).includes(type)) return null;
  const validStatus = (STATUSES as readonly string[]).includes(status)
    ? (status as Activity['status'])
    : undefined;
  if (type === 'voice' && !audioId) return null;
  const durationSec = Number(seconds);
  const call = type === 'call' ? parseCall(data) : null;
  return {
    id,
    leadId,
    at,
    author,
    type: type as Activity['type'],
    text: text ?? '',
    ...(validStatus ? { status: validStatus } : {}),
    ...(audioId
      ? { audio: { id: audioId, durationSec: Number.isFinite(durationSec) ? durationSec : 0, mime: mime || 'audio/webm' } }
      : {}),
    ...(call ? { call } : {}),
  };
}

export function buildActivity(input: NewActivity, now = new Date()): Activity {
  const { leadId, author, type, text, status, audio, call } = input;
  return {
    leadId,
    author,
    type,
    text,
    ...(status ? { status } : {}),
    ...(audio ? { audio } : {}),
    ...(call ? { call } : {}),
    id: `a_${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    at: now.toISOString(),
  };
}
