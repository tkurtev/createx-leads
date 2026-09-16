'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { formatDuration } from '@/lib/audio/validation';
import { cn } from '@/lib/cn';
import type { CallTurn } from '@/lib/leads/types';

type Props = { turns: CallTurn[]; trimmed?: boolean; agentName?: string; className?: string };

/** The conversation as it was spoken, the agent on the left and the lead on the right. */
export function Transcript({ turns, trimmed, agentName = 'Агент', className }: Props) {
  if (turns.length === 0) return null;

  return (
    <div className={cn('space-y-2', className)}>
      {trimmed && (
        <p className="text-xs text-subtle">Началото на разговора е съкратено, за да се побере в таблицата.</p>
      )}
      <ol className="space-y-2.5">
        {turns.map((turn, i) => (
          <li key={i} className={cn('flex flex-col', turn.role === 'lead' ? 'items-end' : 'items-start')}>
            <span className="px-1 text-[11px] font-medium text-subtle">
              {turn.role === 'lead' ? 'Клиент' : agentName}
              {turn.at === undefined ? '' : ` · ${formatDuration(turn.at)}`}
            </span>
            <p
              className={cn(
                'mt-0.5 max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap',
                turn.role === 'lead' ? 'rounded-br-sm bg-primary-soft text-foreground' : 'rounded-bl-sm bg-field text-foreground',
              )}
            >
              {turn.text}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** The conversation, folded away until someone wants to read it. */
export function TranscriptToggle({ turns, trimmed, agentName, className }: Props) {
  const [open, setOpen] = useState(false);
  if (turns.length === 0) return null;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2 rounded-lg py-2 text-sm font-semibold hover:bg-field"
      >
        <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} aria-hidden />
        Транскрипция на разговора
        <span className="ml-auto pr-2 text-xs font-normal text-subtle">{turns.length} реплики</span>
      </button>
      {open && <Transcript turns={turns} trimmed={trimmed} agentName={agentName} className="pt-1 pb-2" />}
    </div>
  );
}
