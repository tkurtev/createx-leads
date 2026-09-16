'use client';

import { CornerDownRight, History } from 'lucide-react';
import { cn } from '@/lib/cn';
import { relativeTime } from '@/lib/format';
import { lastActivity, type LeadWithActivity } from '@/lib/leads/status';
import { activitySummary } from './activity-summary';
import { LeadAvatar } from './avatar';
import { StatusTag } from './status-badge';

type Props = {
  leads: LeadWithActivity[];
  selectedId: string | null;
  unseen: ReadonlySet<string>;
  onSelect: (id: string) => void;
};

export function LeadList({ leads, selectedId, unseen, onSelect }: Props) {
  if (leads.length === 0) {
    return <p className="px-4 py-12 text-center text-sm text-muted">Няма лийдове по тези филтри.</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {leads.map((lead) => {
        const isNew = unseen.has(lead.id);
        const isSelected = lead.id === selectedId;
        const latest = lastActivity(lead.activity);
        const preview = lead.answers[0]?.answer ?? lead.sheetNotes[0];

        return (
          <li key={lead.id}>
            <button
              type="button"
              onClick={() => onSelect(lead.id)}
              aria-current={isSelected ? 'true' : undefined}
              className={cn(
                'flex w-full cursor-pointer gap-3 px-4 py-3.5 text-left',
                'transition-colors duration-150 hover:bg-primary-soft/50',
                isSelected && 'bg-primary-soft hover:bg-primary-soft',
              )}
            >
              <LeadAvatar name={lead.name} fresh={lead.status === 'new'} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {lead.status === 'new' && <StatusTag status="new" />}
                  <span className={cn('min-w-0 truncate text-[15px]', isNew ? 'font-bold' : 'font-semibold')}>
                    {lead.name}
                  </span>
                  {isNew && <span className="ml-auto size-2 shrink-0 rounded-full bg-spark" role="img" aria-label="Нов лийд" />}
                </div>
                {preview && <p className="mt-0.5 truncate text-[13px] text-muted">{preview}</p>}
                <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-subtle">
                  {latest ? (
                    <>
                      <History className="size-3 shrink-0" aria-hidden />
                      <span className="truncate">
                        {relativeTime(latest.at)} · {activitySummary(latest)}
                      </span>
                    </>
                  ) : (
                    <>
                      <CornerDownRight className="size-3 shrink-0" aria-hidden />
                      Добавен {relativeTime(lead.createdAt)}
                    </>
                  )}
                </p>
                {lead.status !== 'new' && (
                  <div className="mt-1.5 flex">
                    <StatusTag status={lead.status} />
                  </div>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
