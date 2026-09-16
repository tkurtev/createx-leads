import type { LeadWithActivity } from './status';
import type { LeadStatus } from './types';

/** Who to call, in the order a salesperson should work through them. */
export const FOLLOW_UP_ORDER: { status: LeadStatus; title: string }[] = [
  { status: 'new', title: 'Още не са търсени' },
  { status: 'call_back', title: 'Да звъннем пак' },
  { status: 'no_answer', title: 'Не вдигнаха' },
  { status: 'interested', title: 'Имат интерес' },
];

export type FollowUpGroup = { status: LeadStatus; title: string; leads: LeadWithActivity[] };

export function followUpGroups(leads: LeadWithActivity[]): FollowUpGroup[] {
  return FOLLOW_UP_ORDER.map(({ status, title }) => ({
    status,
    title,
    // New leads: newest first (speed to lead). Others: waiting longest first.
    leads: leads
      .filter((l) => l.status === status)
      .sort((a, b) => {
        if (status === 'new') return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
        const last = (l: LeadWithActivity) => l.activity.at(-1)?.at ?? l.createdAt ?? '';
        return last(a).localeCompare(last(b));
      }),
  })).filter((group) => group.leads.length > 0);
}

export function followUpCount(leads: LeadWithActivity[]): number {
  const wanted = new Set(FOLLOW_UP_ORDER.map((g) => g.status));
  return leads.filter((l) => wanted.has(l.status)).length;
}
