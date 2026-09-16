import { describe, expect, it } from 'vitest';
import { ACTIVITY_COLUMNS, ACTIVITY_HEADER, activityToRow, buildActivity, rowToActivity } from './activity-rows';

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
    expect(ACTIVITY_COLUMNS).toBe('A:K');
  });
});
