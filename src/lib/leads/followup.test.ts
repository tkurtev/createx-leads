import { describe, expect, it } from 'vitest';
import { followUpCount, followUpGroups } from './followup';
import type { LeadWithActivity } from './status';
import type { Activity } from './types';

const lead = (id: string, status: LeadWithActivity['status'], createdAt: string, lastAt?: string) =>
  ({
    id,
    name: id,
    status,
    createdAt,
    activity: lastAt ? [{ id: `a-${id}`, leadId: id, at: lastAt, author: 'A', type: 'comment', text: '' } as Activity] : [],
  }) as LeadWithActivity;

describe('followUpGroups', () => {
  const leads = [
    lead('old-new', 'new', '2026-09-01T00:00:00Z'),
    lead('fresh-new', 'new', '2026-09-10T00:00:00Z'),
    lead('cb-recent', 'call_back', '2026-08-01T00:00:00Z', '2026-09-09T00:00:00Z'),
    lead('cb-waiting', 'call_back', '2026-08-01T00:00:00Z', '2026-09-02T00:00:00Z'),
    lead('booked', 'booked', '2026-08-01T00:00:00Z'),
    lead('lost', 'lost', '2026-08-01T00:00:00Z'),
  ];

  it('orders groups by urgency and drops empty ones', () => {
    expect(followUpGroups(leads).map((g) => g.status)).toEqual(['new', 'call_back']);
  });

  it('puts the freshest new lead first and the longest-waiting call back first', () => {
    const [fresh, callBack] = followUpGroups(leads);
    expect(fresh.leads.map((l) => l.id)).toEqual(['fresh-new', 'old-new']);
    expect(callBack.leads.map((l) => l.id)).toEqual(['cb-waiting', 'cb-recent']);
  });

  it('counts only leads that still need a call', () => {
    expect(followUpCount(leads)).toBe(4);
    expect(followUpCount([])).toBe(0);
  });
});
