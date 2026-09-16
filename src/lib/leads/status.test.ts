import { describe, expect, it } from 'vitest';
import { attachActivity, currentStatus, lastActivity, statusSince } from './status';
import type { Activity, Lead } from './types';

const base = { author: 'Иван', text: '' };
const act = (id: string, at: string, extra: Partial<Activity>): Activity => ({
  id,
  leadId: 'l1',
  at,
  type: 'comment',
  ...base,
  ...extra,
});

describe('currentStatus', () => {
  it('is "new" when nothing has happened', () => {
    expect(currentStatus([])).toBe('new');
  });

  it('is "in progress" once someone commented or the sheet has notes, but no status was set', () => {
    expect(currentStatus([act('a', '2026-01-01T00:00:00Z', {})])).toBe('in_progress');
    expect(currentStatus([], true)).toBe('in_progress');
  });

  it('stays "new" when the only history is a system note', () => {
    expect(currentStatus([act('a', '2026-01-01T00:00:00Z', { author: 'Система' })])).toBe('new');
  });

  it('takes the latest status from calls or manual changes, regardless of order', () => {
    const list = [
      act('b', '2026-01-03T00:00:00Z', { type: 'call', status: 'interested' }),
      act('a', '2026-01-01T00:00:00Z', { type: 'status', status: 'no_answer' }),
      act('c', '2026-01-04T00:00:00Z', { type: 'comment', text: 'коментар' }),
    ];
    expect(currentStatus(list)).toBe('interested');
  });
});

describe('attachActivity', () => {
  it('groups activity per lead in chronological order', () => {
    const lead = { id: 'l1', sheetNotes: [] as string[] } as Lead;
    const other = { id: 'l2', sheetNotes: [] as string[] } as Lead;
    const [one, two] = attachActivity(
      [lead, other],
      [
        act('late', '2026-01-02T00:00:00Z', { type: 'status', status: 'booked' }),
        act('early', '2026-01-01T00:00:00Z', {}),
      ],
    );
    expect(one.activity.map((a) => a.id)).toEqual(['early', 'late']);
    expect(one.status).toBe('booked');
    expect(two).toMatchObject({ activity: [], status: 'new' });
  });
});

describe('lastActivity', () => {
  it('returns null when nothing happened yet', () => {
    expect(lastActivity([])).toBeNull();
  });
  it('picks the newest entry of any type', () => {
    const list = [
      act('a', '2026-01-02T00:00:00Z', {}),
      act('b', '2026-01-05T00:00:00Z', { type: 'email', text: 'x' }),
      act('c', '2026-01-03T00:00:00Z', { type: 'status', status: 'lost' }),
    ];
    expect(lastActivity(list)?.id).toBe('b');
  });
});

describe('statusSince', () => {
  it('falls back to when the lead arrived', () => {
    expect(statusSince({ createdAt: '2026-01-01T00:00:00Z' }, [act('a', '2026-01-02T00:00:00Z', {})])).toBe(
      '2026-01-01T00:00:00Z',
    );
  });
  it('uses the latest status change', () => {
    const list = [
      act('a', '2026-01-02T00:00:00Z', { type: 'call', status: 'no_answer' }),
      act('b', '2026-01-04T00:00:00Z', { type: 'status', status: 'interested' }),
      act('c', '2026-01-06T00:00:00Z', {}),
    ];
    expect(statusSince({ createdAt: null }, list)).toBe('2026-01-04T00:00:00Z');
  });
});
