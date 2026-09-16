'use client';

import { Bot, ListChecks, PhoneOff } from 'lucide-react';
import { formatDuration } from '@/lib/audio/validation';
import { cn } from '@/lib/cn';
import { fullDate, relativeTime } from '@/lib/format';
import {
  QUALIFICATION_HINTS,
  QUALIFICATION_LABELS,
  type Activity,
  type CallDetails,
  type CallQualification,
} from '@/lib/leads/types';
import { StatusTag } from './status-badge';
import { TranscriptToggle } from './transcript';
import { VoicePlayer } from '../voice/voice-player';

const QUALIFICATION_STYLES: Record<CallQualification, string> = {
  hot: 'bg-spark text-white',
  warm: 'bg-brand-purple text-white',
  cold: 'bg-brand-blue text-white',
  unqualified: 'bg-brand-navy/60 text-white',
  unknown: 'bg-field text-muted',
};

export function QualificationTag({ value, className }: { value: CallQualification; className?: string }) {
  return (
    <span
      title={QUALIFICATION_HINTS[value]}
      className={cn(
        'inline-flex shrink-0 items-center rounded-[3px] px-1.5 py-0.5 text-[11px] leading-tight font-medium',
        QUALIFICATION_STYLES[value],
        className,
      )}
    >
      {QUALIFICATION_LABELS[value]}
    </span>
  );
}

/**
 * What the AI call produced, for the top of a lead: how warm they are, what was
 * said, what to do next, and the recording. The fields come from the call
 * itself, so this stays the same whatever the business sells.
 */
export function CallCard({ activity, agentName }: { activity: Activity & { call: CallDetails }; agentName: string }) {
  const { call } = activity;
  const facts = call.facts ?? [];
  const nextSteps = call.nextSteps ?? [];

  if (call.state === 'queued') {
    return (
      <section
        aria-label="Обаждане в момента"
        className="flex items-center gap-3 rounded-2xl border border-action/30 bg-surface px-4 py-3.5 shadow-[0_1px_3px_rgba(27,29,42,0.06)]"
      >
        <span className="relative flex size-9 shrink-0 items-center justify-center rounded-md bg-action text-white">
          <Bot className="size-4.5" aria-hidden />
          <span className="absolute -top-0.5 -right-0.5 size-2.5 animate-pulse rounded-full bg-spark" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{agentName} звъни на клиента</p>
          <p className="text-[13px] text-muted">
            Насрочено {relativeTime(activity.at)} · резултатът ще се появи тук веднага след разговора.
          </p>
        </div>
      </section>
    );
  }

  const unanswered = call.reached === false;

  return (
    <section
      aria-label="Резултат от AI обаждането"
      className="overflow-hidden rounded-2xl bg-surface shadow-[0_1px_3px_rgba(27,29,42,0.06)]"
    >
      <div className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-md text-white',
            unanswered ? 'bg-orange-500' : 'bg-action',
          )}
        >
          {unanswered ? <PhoneOff className="size-4.5" aria-hidden /> : <Bot className="size-4.5" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="label-caps text-foreground">{unanswered ? 'AI обаждане' : `${agentName} разговаря`}</span>
            {activity.status && <StatusTag status={activity.status} />}
            {call.qualification && call.qualification !== 'unknown' && <QualificationTag value={call.qualification} />}
          </div>
          <p className="mt-0.5 text-xs text-subtle">
            <time dateTime={activity.at} title={fullDate(activity.at)}>
              {relativeTime(activity.at)}
            </time>
            {call.durationSec ? ` · ${formatDuration(call.durationSec)} мин.` : ''}
          </p>
          {call.summary && <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-wrap">{call.summary}</p>}
        </div>
      </div>

      {nextSteps.length > 0 && (
        <div className="border-t border-border px-4 py-3.5 sm:px-5">
          <p className="label-caps flex items-center gap-1.5">
            <ListChecks className="size-3.5" aria-hidden />
            Следващи стъпки
          </p>
          <ul className="mt-2 space-y-1.5">
            {nextSteps.map((step, i) => (
              <li key={i} className="flex gap-2 text-sm leading-relaxed">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-action" aria-hidden />
                {step}
              </li>
            ))}
          </ul>
          {call.callbackAt && (
            <p className="mt-2.5 text-[13px] font-medium text-action">Да потърсим: {fullDate(call.callbackAt)}</p>
          )}
        </div>
      )}

      {facts.length > 0 && (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 border-t border-border px-4 py-3.5 sm:grid-cols-2 sm:px-5">
          {facts.map((fact, i) => (
            <div key={i} className="min-w-0">
              <dt className="label-caps text-subtle">{fact.label}</dt>
              <dd className="mt-0.5 text-sm break-words">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {call.recordingUrl && (
        <div className="border-t border-border px-4 py-3 sm:px-5">
          <VoicePlayer src={call.recordingUrl} durationSec={call.durationSec ?? 0} />
        </div>
      )}

      {call.transcript && call.transcript.length > 0 && (
        <div className="border-t border-border px-2 sm:px-3">
          <TranscriptToggle turns={call.transcript} trimmed={call.transcriptTrimmed} agentName={agentName} />
        </div>
      )}
    </section>
  );
}
