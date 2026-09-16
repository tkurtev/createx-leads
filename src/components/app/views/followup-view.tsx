'use client';

import { PartyPopper } from 'lucide-react';
import { followUpGroups } from '@/lib/leads/followup';
import type { LeadWithActivity } from '@/lib/leads/status';
import { LeadList } from '../../leads/lead-list';
import { STATUS_STYLES } from '../../leads/status-badge';
import { cn } from '@/lib/cn';

type Props = {
  leads: LeadWithActivity[];
  unseen: ReadonlySet<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function FollowUpView({ leads, unseen, selectedId, onSelect }: Props) {
  const groups = followUpGroups(leads);

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <PartyPopper className="size-7" aria-hidden />
        </span>
        <p className="text-base font-bold">Няма кого да търсите</p>
        <p className="text-sm text-muted">Всички лийдове са записани или са отказали. Новите ще се появят тук.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="px-4 pt-4 pb-1 text-[13px] text-muted">Започнете отгоре надолу: първо най-новите, после тези, които чакат най-дълго.</p>
      {groups.map((group) => (
        <section key={group.status} aria-labelledby={`fu-${group.status}`}>
          <h2
            id={`fu-${group.status}`}
            className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-surface/95 px-4 pt-4 pb-2 backdrop-blur"
          >
            <span className={cn('size-3 rounded-[3px]', STATUS_STYLES[group.status].square)} aria-hidden />
            <span className="label-caps">{group.title}</span>
            <span className="ml-auto rounded-full bg-field px-2 text-xs font-semibold text-muted tabular-nums">
              {group.leads.length}
            </span>
          </h2>
          <LeadList leads={group.leads} selectedId={selectedId} unseen={unseen} onSelect={onSelect} />
        </section>
      ))}
    </div>
  );
}
