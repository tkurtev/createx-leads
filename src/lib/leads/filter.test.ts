import { describe, expect, it } from 'vitest';
import { filterLeads } from './filter';
import type { LeadWithActivity } from './status';

const lead = (id: string, name: string, extra: Partial<LeadWithActivity> = {}) =>
  ({ id, name, email: null, phone: null, status: 'new', activity: [], ...extra }) as LeadWithActivity;

const leads = [
  lead('1', 'Мария Иванова', { phone: '+359888123456', email: 'maria@example.com' }),
  lead('2', 'Georgi Petrov', { status: 'booked' }),
  lead('3', 'Елена', { status: 'lost' }),
];

describe('filterLeads', () => {
  const none = new Set<string>();

  it('returns everything by default', () => {
    expect(filterLeads(leads, 'all', '', none)).toHaveLength(3);
  });

  it('filters by status', () => {
    expect(filterLeads(leads, 'booked', '', none).map((l) => l.id)).toEqual(['2']);
  });

  it('filters to unseen leads', () => {
    expect(filterLeads(leads, 'unseen', '', new Set(['3'])).map((l) => l.id)).toEqual(['3']);
  });

  it('searches name case-insensitively, email and phone in local format', () => {
    expect(filterLeads(leads, 'all', 'мария', none).map((l) => l.id)).toEqual(['1']);
    expect(filterLeads(leads, 'all', 'GEORGI', none).map((l) => l.id)).toEqual(['2']);
    expect(filterLeads(leads, 'all', 'maria@', none).map((l) => l.id)).toEqual(['1']);
    expect(filterLeads(leads, 'all', '0888 123', none).map((l) => l.id)).toEqual(['1']);
    expect(filterLeads(leads, 'all', '359888', none).map((l) => l.id)).toEqual(['1']);
  });

  it('does not match on one or two stray digits', () => {
    expect(filterLeads(leads, 'all', '88', none)).toEqual([]);
  });
});
