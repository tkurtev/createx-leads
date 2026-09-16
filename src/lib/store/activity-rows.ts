import { ACTIVITY_TYPES, STATUSES, type Activity } from '@/lib/leads/types';
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
];

export const ACTIVITY_COLUMNS = `A:${String.fromCharCode(64 + ACTIVITY_HEADER.length)}`;

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
  ];
}

export function rowToActivity(row: string[]): Activity | null {
  const [id, leadId, at, author, type, status, text, , audioId, seconds, mime] = row.map((v) => v ?? '');
  if (!id || !leadId || !at) return null;
  if (!(ACTIVITY_TYPES as readonly string[]).includes(type)) return null;
  const validStatus = (STATUSES as readonly string[]).includes(status)
    ? (status as Activity['status'])
    : undefined;
  if (type === 'voice' && !audioId) return null;
  const durationSec = Number(seconds);
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
  };
}

export function buildActivity(input: NewActivity, now = new Date()): Activity {
  const { leadId, author, type, text, status, audio } = input;
  return {
    leadId,
    author,
    type,
    text,
    ...(status ? { status } : {}),
    ...(audio ? { audio } : {}),
    id: `a_${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    at: now.toISOString(),
  };
}
