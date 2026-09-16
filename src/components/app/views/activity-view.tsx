'use client';

import { Bot, History, Mail, MessageSquare, Mic, PhoneCall } from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { fullDate, relativeTime } from '@/lib/format';
import { teamFeed, type FeedFilter } from '@/lib/leads/feed';
import type { LeadWithActivity } from '@/lib/leads/status';
import { activitySummary } from '../../leads/activity-summary';
import { QualificationTag } from '../../leads/call-card';
import { VoicePlayer } from '../../voice/voice-player';

const FILTERS: { id: FeedFilter; label: string }[] = [
  { id: 'all', label: 'Всичко' },
  { id: 'voice', label: 'Гласови' },
  { id: 'call', label: 'Обаждания' },
  { id: 'comment', label: 'Коментари' },
  { id: 'email', label: 'Имейли' },
];

const ICONS = { comment: MessageSquare, call: PhoneCall, email: Mail, voice: Mic, status: History };

type Props = { leads: LeadWithActivity[]; onSelect: (id: string) => void };

export function ActivityView({ leads, onSelect }: Props) {
  const [filter, setFilter] = useState<FeedFilter>('all');
  const items = useMemo(() => teamFeed(leads, filter), [leads, filter]);

  return (
    <div>
      <div
        role="group"
        aria-label="Вид активност"
        className="flex gap-2 overflow-x-auto border-b border-border px-3 py-3 [scrollbar-width:none]"
      >
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'h-9 shrink-0 cursor-pointer rounded-full border px-3.5 text-[13px] font-semibold transition-colors',
              filter === f.id
                ? 'border-foreground bg-foreground text-white'
                : 'border-border text-muted hover:border-foreground/40 hover:text-foreground',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="px-6 py-16 text-center text-sm text-muted">
          Още няма активност. Обажданията, коментарите и гласовите бележки на екипа ще се виждат тук.
        </p>
      ) : (
        <ol className="divide-y divide-border">
          {items.map(({ activity, lead }) => {
            const Icon = activity.call ? Bot : ICONS[activity.type];
            return (
              <li key={activity.id} className="flex gap-3 px-4 py-3.5">
                <span
                  className={cn(
                    'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md',
                    activity.type === 'comment' ? 'bg-avatar text-white' : activity.type === 'email' ? 'bg-primary-soft text-primary' : 'bg-action text-white',
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-muted">
                    <span className="font-semibold text-foreground">{activity.author}</span>
                    {' към '}
                    <button
                      type="button"
                      onClick={() => onSelect(lead.id)}
                      className="cursor-pointer font-semibold text-primary hover:underline"
                    >
                      {lead.name}
                    </button>
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm">
                    {activity.type === 'comment' ? (
                      <span className="line-clamp-3 whitespace-pre-wrap">{activity.text}</span>
                    ) : (
                      activitySummary(activity)
                    )}
                    {activity.call?.qualification && activity.call.qualification !== 'unknown' && (
                      <QualificationTag value={activity.call.qualification} />
                    )}
                  </p>
                  {activity.type === 'call' && activity.text && (
                    <p className="mt-0.5 line-clamp-2 text-[13px] text-muted">{activity.text}</p>
                  )}
                  {activity.type === 'voice' && activity.audio && (
                    <div className="mt-2 max-w-sm rounded-2xl bg-field py-1.5 pr-4 pl-1.5">
                      <VoicePlayer
                        src={`/api/audio/${encodeURIComponent(activity.audio.id)}`}
                        durationSec={activity.audio.durationSec}
                      />
                    </div>
                  )}
                  <time dateTime={activity.at} title={fullDate(activity.at)} className="mt-1 block text-xs text-subtle">
                    {relativeTime(activity.at)}
                  </time>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
