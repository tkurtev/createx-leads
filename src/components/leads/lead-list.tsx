'use client';

import { Bot, CornerDownRight, History } from 'lucide-react';
import { cn } from '@/lib/cn';
import { relativeTime } from '@/lib/format';
import { lastFinishedCall, pendingCall } from '@/lib/leads/calls';
import { lastActivity, type LeadWithActivity } from '@/lib/leads/status';
import { activitySummary } from './activity-summary';
import { LeadAvatar } from './avatar';
import { QualificationTag } from './call-card';
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
        const ringing = pendingCall(lead.activity);
        const qualification = ringing ? null : lastFinishedCall(lead.activity)?.call.qualification;

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
                {(lead.status !== 'new' || ringing || qualification) && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {lead.status !== 'new' && <StatusTag status={lead.status} />}
                    {ringing && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-[3px] bg-action px-1.5 py-0.5 text-[11px] leading-tight font-medium text-white">
                        <Bot className="size-3" aria-hidden />
                        AI звъни
                      </span>
                    )}
                    {qualification && qualification !== 'unknown' && <QualificationTag value={qualification} />}
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
