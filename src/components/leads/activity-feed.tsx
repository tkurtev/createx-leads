import { Mail, MessageSquare, Mic, NotebookText, PhoneCall, Tag } from 'lucide-react';
import { cn } from '@/lib/cn';
import { fullDate, relativeTime } from '@/lib/format';
import { STATUS_LABELS, type Activity } from '@/lib/leads/types';
import { VoicePlayer } from '../voice/voice-player';

const ICONS = { comment: MessageSquare, call: PhoneCall, email: Mail, status: Tag, voice: Mic };

function title(activity: Activity) {
  switch (activity.type) {
    case 'call':
      return `Обаждане${activity.status ? `: ${STATUS_LABELS[activity.status]}` : ''}`;
    case 'email':
      return 'Изпратен имейл';
    case 'status':
      return `Статус: ${activity.status ? STATUS_LABELS[activity.status] : ''}`;
    case 'voice':
      return 'Гласова бележка';
    default:
      return null;
  }
}

export function ActivityFeed({ activity, sheetNotes }: { activity: Activity[]; sheetNotes: string[] }) {
  if (activity.length === 0 && sheetNotes.length === 0) {
    return <p className="py-6 text-center text-sm text-muted">Още няма коментари. Бъдете първи.</p>;
  }

  return (
    <ol className="space-y-4">
      {sheetNotes.length > 0 && (
        <li className="flex gap-3">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-field text-muted">
            <NotebookText className="size-3.5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">Бележки от таблицата</p>
            <ul className="mt-1 space-y-1.5">
              {sheetNotes.map((note, i) => (
                <li key={i} className="rounded-lg bg-field px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap">
                  {note}
                </li>
              ))}
            </ul>
          </div>
        </li>
      )}
      {activity.map((item) => {
        const Icon = ICONS[item.type];
        const heading = title(item);
        const [subject, ...rest] = item.type === 'email' ? item.text.split('\n\n') : [];
        return (
          <li key={item.id} className="flex gap-3">
            <span
              className={cn(
                'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md',
                item.type === 'comment' ? 'bg-avatar text-white' : item.type === 'call' || item.type === 'voice' ? 'bg-action text-white' : 'bg-primary-soft text-primary',
              )}
            >
              <Icon className="size-3.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">
                <span className="font-medium text-foreground">{item.author}</span>
                {' · '}
                <time dateTime={item.at} title={fullDate(item.at)}>
                  {relativeTime(item.at)}
                </time>
              </p>
              {heading && <p className="mt-0.5 text-sm font-medium">{heading}</p>}
              {item.type === 'voice' && item.audio ? (
                <div className="mt-1.5 max-w-sm rounded-2xl bg-field py-1.5 pr-4 pl-1.5">
                  <VoicePlayer src={`/api/audio/${encodeURIComponent(item.audio.id)}`} durationSec={item.audio.durationSec} />
                </div>
              ) : item.type === 'email' ? (
                <details className="mt-1 rounded-lg bg-field px-3 py-2 text-sm">
                  <summary className="cursor-pointer font-medium">{subject}</summary>
                  <p className="mt-2 leading-relaxed whitespace-pre-wrap text-muted">{rest.join('\n\n')}</p>
                </details>
              ) : (
                item.text && (
                  <p className="mt-1 rounded-lg bg-field px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap">
                    {item.text}
                  </p>
                )
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
