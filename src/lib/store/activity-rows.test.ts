import { describe, expect, it } from 'vitest';
import type { CallDetails } from '@/lib/leads/types';
import { ACTIVITY_COLUMNS, ACTIVITY_HEADER, activityToRow, buildActivity, parseCall, rowToActivity } from './activity-rows';

describe('activity rows', () => {
  it('round-trips through a sheet row', () => {
    const activity = buildActivity(
      { leadId: 'l1', author: 'Иван', type: 'call', status: 'call_back', text: 'в четвъртък', leadName: 'Мария' },
      new Date('2026-09-15T10:00:00Z'),
    );
    const row = activityToRow(activity, 'Мария');
    expect(row[7]).toBe('Мария');
    expect(rowToActivity(row)).toEqual(activity);
  });

  it('does not leak leadName into the stored activity', () => {
    const activity = buildActivity({ leadId: 'l1', author: 'A', type: 'comment', text: 'x', leadName: 'N' });
    expect(activity).not.toHaveProperty('leadName');
    expect(activity.id).toMatch(/^a_/);
  });

  it('skips rows someone typed by hand that are incomplete or unknown', () => {
    expect(rowToActivity([])).toBeNull();
    expect(rowToActivity(['a1', 'l1', '2026-01-01T00:00:00Z', 'A', 'sms'])).toBeNull();
  });

  it('drops an unknown status but keeps the activity', () => {
    const parsed = rowToActivity(['a1', 'l1', '2026-01-01T00:00:00Z', 'A', 'comment', 'maybe', 'hi']);
    expect(parsed).toEqual({ id: 'a1', leadId: 'l1', at: '2026-01-01T00:00:00Z', author: 'A', type: 'comment', text: 'hi' });
  });
});

describe('voice note rows', () => {
  it('round-trips the audio reference', () => {
    const activity = buildActivity(
      {
        leadId: 'l1',
        author: 'Иван',
        type: 'voice',
        text: '',
        audio: { id: 'drive-file-123', durationSec: 23.4, mime: 'audio/webm;codecs=opus' },
      },
      new Date('2026-09-15T10:00:00Z'),
    );
    const row = activityToRow(activity, 'Мария');
    expect(row).toHaveLength(ACTIVITY_HEADER.length);
    expect(rowToActivity(row)).toEqual(activity);
  });

  it('still reads rows written before audio columns existed', () => {
    const old = ['a1', 'l1', '2026-01-01T00:00:00Z', 'A', 'comment', '', 'hi', 'Мария'];
    expect(rowToActivity(old)).toMatchObject({ id: 'a1', text: 'hi' });
    expect(rowToActivity(old)).not.toHaveProperty('audio');
  });

  it('skips a voice row whose audio reference was lost', () => {
    expect(rowToActivity(['a1', 'l1', '2026-01-01T00:00:00Z', 'A', 'voice', '', '', ''])).toBeNull();
  });

  it('tolerates a garbled duration', () => {
    const row = ['a1', 'l1', '2026-01-01T00:00:00Z', 'A', 'voice', '', '', '', 'f1', 'abc', ''];
    expect(rowToActivity(row)?.audio).toEqual({ id: 'f1', durationSec: 0, mime: 'audio/webm' });
  });

  it('covers every header column', () => {
    expect(ACTIVITY_COLUMNS).toBe('A:L');
  });
});

describe('AI call rows', () => {
  const call: CallDetails = {
    provider: 'vapi',
    callId: 'c_1',
    state: 'ended',
    reached: true,
    durationSec: 95,
    recordingUrl: 'https://rec.example/1.mp3',
    summary: 'Иска да продължи, но иска оферта по имейл.',
    qualification: 'warm',
    nextSteps: ['Да се изпрати оферта', 'Да се звънне в четвъртък'],
    callbackAt: '2026-09-18T14:00:00.000Z',
    facts: [{ label: 'Бюджет', value: 'до 5000 лв' }],
    transcript: [
      { role: 'agent', text: 'Добър ден!', at: 0 },
      { role: 'lead', text: 'Здравейте.', at: 3 },
    ],
  };

  it('round-trips every call detail through the data column', () => {
    const activity = buildActivity(
      { leadId: 'l1', author: 'AI агент', type: 'call', text: 'Иска оферта', status: 'interested', call },
      new Date('2026-09-15T10:00:00Z'),
    );
    const row = activityToRow(activity, 'Мария');
    expect(row).toHaveLength(ACTIVITY_HEADER.length);
    expect(rowToActivity(row)).toEqual(activity);
  });

  it('keeps the row when the data cell is garbled', () => {
    const row = ['a1', 'l1', '2026-01-01T00:00:00Z', 'AI агент', 'call', 'interested', 'текст', 'Мария', '', '', '', '{oops'];
    const parsed = rowToActivity(row);
    expect(parsed).toMatchObject({ id: 'a1', text: 'текст', status: 'interested' });
    expect(parsed).not.toHaveProperty('call');
  });

  it('ignores call data on activities that are not calls', () => {
    const row = ['a1', 'l1', '2026-01-01T00:00:00Z', 'Иван', 'comment', '', 'хей', '', '', '', '', JSON.stringify(call)];
    expect(rowToActivity(row)).not.toHaveProperty('call');
  });

  it('rejects data that is not a call object', () => {
    expect(parseCall('')).toBeNull();
    expect(parseCall('"text"')).toBeNull();
    expect(parseCall('[1,2]')).toBeNull();
    expect(parseCall('{"state":"ended"}')).toBeNull();
  });

  it('trims a transcript too long for a sheet cell, keeping the end and the summary', () => {
    const long = Array.from({ length: 400 }, (_, i) => ({
      role: (i % 2 === 0 ? 'agent' : 'lead') as 'agent' | 'lead',
      text: `реплика ${i} `.repeat(30),
      at: i,
    }));
    const row = activityToRow(
      buildActivity({ leadId: 'l1', author: 'AI агент', type: 'call', text: '', call: { ...call, transcript: long } }),
      'Мария',
    );
    expect(row[11].length).toBeLessThanOrEqual(45_000);
    const parsed = rowToActivity(row)!.call!;
    expect(parsed.transcriptTrimmed).toBe(true);
    expect(parsed.summary).toBe(call.summary);
    expect(parsed.transcript!.length).toBeGreaterThan(0);
    // The end of the conversation is what was agreed, so it must survive.
    expect(parsed.transcript!.at(-1)).toEqual(long.at(-1));
  });
});
