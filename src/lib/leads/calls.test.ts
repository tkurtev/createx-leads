import { describe, expect, it } from 'vitest';
import { lastFinishedCall, latestCall, pendingCall } from './calls';
import type { Activity, CallDetails } from './types';

const call = (state: CallDetails['state']): CallDetails => ({ provider: 'vapi', state });

const act = (id: string, at: string, extra: Partial<Activity> = {}): Activity => ({
  id,
  leadId: 'l1',
  at,
  author: 'AI агент',
  type: 'call',
  text: '',
  ...extra,
});

describe('call helpers', () => {
  it('find nothing on a lead nobody called', () => {
    const only = [act('a', '2026-01-01T00:00:00Z', { type: 'comment', author: 'Иван', text: 'хей' })];
    expect(latestCall(only)).toBeNull();
    expect(lastFinishedCall(only)).toBeNull();
    expect(pendingCall(only)).toBeNull();
  });

  it('pick the newest call regardless of order', () => {
    const list = [
      act('old', '2026-01-01T00:00:00Z', { call: call('ended') }),
      act('new', '2026-01-03T00:00:00Z', { call: call('queued') }),
      act('mid', '2026-01-02T00:00:00Z', { call: call('ended') }),
    ];
    expect(latestCall(list)?.id).toBe('new');
    expect(lastFinishedCall(list)?.id).toBe('mid');
    expect(pendingCall(list)?.id).toBe('new');
  });

  it('report no pending call once the newest one came back', () => {
    const list = [
      act('a', '2026-01-01T00:00:00Z', { call: call('queued') }),
      act('b', '2026-01-02T00:00:00Z', { call: call('ended') }),
    ];
    expect(pendingCall(list)).toBeNull();
    expect(lastFinishedCall(list)?.id).toBe('b');
  });
});
