import { describe, expect, it } from 'vitest';
import { teamFeed } from './feed';
import type { LeadWithActivity } from './status';
import type { Activity } from './types';

const a = (id: string, at: string, type: Activity['type']): Activity => ({
  id,
  leadId: 'x',
  at,
  author: 'A',
  type,
  text: '',
});

const leads = [
  { id: 'l1', name: 'Мария', activity: [a('1', '2026-09-01T10:00:00Z', 'comment'), a('2', '2026-09-03T10:00:00Z', 'voice')] },
  { id: 'l2', name: 'Иван', activity: [a('3', '2026-09-02T10:00:00Z', 'call'), a('4', '2026-09-04T10:00:00Z', 'status')] },
] as unknown as LeadWithActivity[];

describe('teamFeed', () => {
  it('merges all leads newest first and hides bare status changes', () => {
    expect(teamFeed(leads).map((i) => i.activity.id)).toEqual(['2', '3', '1']);
  });

  it('keeps a reference to the lead for each item', () => {
    expect(teamFeed(leads)[0].lead.name).toBe('Мария');
  });

  it('filters by type', () => {
    expect(teamFeed(leads, 'voice').map((i) => i.activity.id)).toEqual(['2']);
    expect(teamFeed(leads, 'email')).toEqual([]);
  });

  it('caps the length', () => {
    expect(teamFeed(leads, 'all', 1)).toHaveLength(1);
  });
});
