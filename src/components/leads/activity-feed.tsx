import { Bot, Mail, MessageSquare, Mic, NotebookText, PhoneCall, Tag } from 'lucide-react';
import { formatDuration } from '@/lib/audio/validation';
import { cn } from '@/lib/cn';
import { fullDate, relativeTime } from '@/lib/format';
import { STATUS_LABELS, type Activity, type CallDetails } from '@/lib/leads/types';
import { QualificationTag } from './call-card';
import { TranscriptToggle } from './transcript';
import { VoicePlayer } from '../voice/voice-player';

const ICONS = { comment: MessageSquare, call: PhoneCall, email: Mail, status: Tag, voice: Mic };

function title(activity: Activity) {
  switch (activity.type) {
    case 'call': {
      const kind = activity.call ? 'AI обаждане' : 'Обаждане';
      const length = activity.call?.durationSec ? ` · ${formatDuration(activity.call.durationSec)} мин.` : '';
      return `${kind}${activity.status ? `: ${STATUS_LABELS[activity.status]}` : ''}${length}`;
    }
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

/** Everything the AI call left behind, under the note the agent wrote. */
function CallExtras({ call, agentName }: { call: CallDetails; agentName: string }) {
  const nextSteps = call.nextSteps ?? [];
  const facts = call.facts ?? [];

  if (call.state === 'queued') {
    return <p className="mt-1 text-[13px] text-muted">Изчаква резултата от разговора.</p>;
  }

  return (
    <div className="mt-2 space-y-2">
      {nextSteps.length > 0 && (
        <ul className="space-y-1">
          {nextSteps.map((step, i) => (
            <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-foreground">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-action" aria-hidden />
              {step}
            </li>
          ))}
        </ul>
      )}
      {facts.length > 0 && (
        <dl className="flex flex-wrap gap-x-4 gap-y-1">
          {facts.map((fact, i) => (
            <div key={i} className="text-[13px]">
              <dt className="inline text-subtle">{fact.label}: </dt>
              <dd className="inline">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {call.callbackAt && (
        <p className="text-[13px] font-medium text-action">Да потърсим: {fullDate(call.callbackAt)}</p>
      )}
      {call.recordingUrl && (
        <div className="max-w-sm rounded-2xl bg-field py-1.5 pr-4 pl-1.5">
          <VoicePlayer src={call.recordingUrl} durationSec={call.durationSec ?? 0} />
        </div>
      )}
      {call.transcript && call.transcript.length > 0 && (
        <TranscriptToggle turns={call.transcript} trimmed={call.transcriptTrimmed} agentName={agentName} />
      )}
    </div>
  );
}

type FeedProps = { activity: Activity[]; sheetNotes: string[]; agentName?: string };

export function ActivityFeed({ activity, sheetNotes, agentName = 'AI агент' }: FeedProps) {
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
        const Icon = item.call ? Bot : ICONS[item.type];
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
              {heading && (
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm font-medium">
                  {heading}
                  {item.call?.qualification && item.call.qualification !== 'unknown' && (
                    <QualificationTag value={item.call.qualification} />
                  )}
                </p>
              )}
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
              {item.call && <CallExtras call={item.call} agentName={agentName} />}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
