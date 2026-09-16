import type { LeadWithActivity } from './status';
import type { LeadStatus } from './types';

export type LeadFilter = 'all' | 'unseen' | LeadStatus;

export function filterLeads(
  leads: LeadWithActivity[],
  filter: LeadFilter,
  query: string,
  unseen: ReadonlySet<string>,
): LeadWithActivity[] {
  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, '');

  return leads.filter((lead) => {
    if (filter === 'unseen' && !unseen.has(lead.id)) return false;
    if (filter !== 'all' && filter !== 'unseen' && lead.status !== filter) return false;
    if (!q) return true;
    if (lead.name.toLowerCase().includes(q)) return true;
    if (lead.email?.includes(q)) return true;
    // "0888 123" should find "+359888123..."
    if (digits.length >= 3 && lead.phone?.replace(/^\+359/, '0').includes(digits)) return true;
    if (digits.length >= 3 && lead.phone?.includes(digits)) return true;
    return false;
  });
}
