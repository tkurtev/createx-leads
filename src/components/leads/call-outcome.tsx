'use client';

import { Loader2, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import type { LeadWithActivity } from '@/lib/leads/status';
import { STATUS_LABELS, type Activity, type LeadStatus } from '@/lib/leads/types';
import { postJson } from './post';
import { STATUS_STYLES } from './status-badge';

const OUTCOMES: LeadStatus[] = ['no_answer', 'call_back', 'interested', 'booked', 'lost'];

type Props = {
  lead: LeadWithActivity;
  onSaved: (activity: Activity) => void;
  onClose: () => void;
};

export function CallOutcome({ lead, onSaved, onClose }: Props) {
  const [outcome, setOutcome] = useState<LeadStatus | null>(null);
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!outcome) return;
    setPending(true);
    setError(null);
    try {
      const { activity } = await postJson<{ activity: Activity }>('/api/activity', {
        leadId: lead.id,
        leadName: lead.name,
        type: 'call',
        status: outcome,
        text: note,
      });
      onSaved(activity);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не се запази.');
      setPending(false);
    }
  }

  return (
    <section aria-label="Резултат от обаждането" className="rounded-2xl border-2 border-action/30 bg-surface p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="label-caps">Как мина разговорът?</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Затвори"
          className="flex size-8 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-field"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {OUTCOMES.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setOutcome(value)}
            aria-pressed={outcome === value}
            className={cn(
              'flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-sm',
              'transition-colors hover:border-foreground/40',
              outcome === value ? 'border-foreground bg-field font-semibold' : 'border-border',
            )}
          >
            <span className={cn('size-3 rounded-[3px]', STATUS_STYLES[value].square)} aria-hidden />
            {STATUS_LABELS[value]}
          </button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Бележка, напр. да звъннем в четвъртък след 17:00"
        className={cn(
          'mt-3 w-full resize-y rounded-xl border border-transparent bg-field px-4 py-2.5 text-base',
          'placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none sm:text-sm',
        )}
      />
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={!outcome || pending}
          className={cn(
            'flex h-11 cursor-pointer items-center gap-2 rounded-full bg-action px-5 text-sm font-semibold text-white',
            'transition-colors hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Запази обаждането
        </button>
      </div>
    </section>
  );
}
