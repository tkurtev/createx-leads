'use client';

import { Loader2, Mic, Send, Square, Trash2 } from 'lucide-react';
import { forwardRef, useState } from 'react';
import { formatDuration, MAX_VOICE_SECONDS } from '@/lib/audio/validation';
import { cn } from '@/lib/cn';
import type { LeadWithActivity } from '@/lib/leads/status';
import type { Activity } from '@/lib/leads/types';
import { useVoiceRecorder } from '../voice/use-voice-recorder';
import { VoicePlayer } from '../voice/voice-player';
import { postJson } from './post';

type Props = {
  lead: LeadWithActivity;
  voiceEnabled: boolean;
  onSaved: (activity: Activity) => void;
};

const roundButton = cn(
  'flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors',
  'disabled:cursor-not-allowed disabled:opacity-40',
);

export const CommentComposer = forwardRef<HTMLTextAreaElement, Props>(function CommentComposer(
  { lead, voiceEnabled, onSaved },
  ref,
) {
  const [comment, setComment] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const voice = useVoiceRecorder();

  async function sendComment() {
    if (!comment.trim()) return;
    setPending(true);
    setError(null);
    try {
      const { activity } = await postJson<{ activity: Activity }>('/api/activity', {
        leadId: lead.id,
        leadName: lead.name,
        type: 'comment',
        text: comment,
      });
      onSaved(activity);
      setComment('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не се запази.');
    } finally {
      setPending(false);
    }
  }

  async function sendVoice() {
    const recording = voice.recording;
    if (!recording) return;
    setPending(true);
    setError(null);
    try {
      const form = new FormData();
      form.set('leadId', lead.id);
      form.set('leadName', lead.name);
      form.set('durationSec', String(recording.durationSec));
      form.set('audio', recording.blob, 'voice-note');
      const response = await fetch('/api/voice', { method: 'POST', body: form });
      const data = (await response.json().catch(() => ({}))) as { activity?: Activity; error?: string };
      if (response.status === 401) window.location.href = '/login';
      if (!response.ok || !data.activity) throw new Error(data.error ?? 'Гласовата бележка не се запази.');
      onSaved(data.activity);
      voice.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Гласовата бележка не се запази.');
    } finally {
      setPending(false);
    }
  }

  const message = error ?? voice.error;

  return (
    <div className="sticky bottom-0 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-6">
      {message && (
        <p role="alert" className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {message}
        </p>
      )}

      {voice.phase === 'recording' || voice.phase === 'starting' ? (
        <div className="flex items-center gap-2" aria-live="polite">
          <button
            type="button"
            onClick={voice.cancel}
            aria-label="Откажи записа"
            className={cn(roundButton, 'text-muted hover:bg-field')}
          >
            <Trash2 className="size-5" aria-hidden />
          </button>
          <div className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-full bg-field px-4">
            <span className="relative flex size-2.5 shrink-0">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
            </span>
            <span className="w-10 shrink-0 text-sm font-semibold tabular-nums">{formatDuration(voice.elapsed)}</span>
            <div className="flex h-7 min-w-0 flex-1 items-center justify-end gap-[3px] overflow-hidden" aria-hidden>
              {voice.levels.map((level, i) => (
                <span
                  key={i}
                  className="w-[3px] shrink-0 rounded-full bg-action"
                  style={{ height: `${Math.max(12, level * 100)}%` }}
                />
              ))}
            </div>
            {voice.elapsed > MAX_VOICE_SECONDS - 15 && (
              <span className="shrink-0 text-xs text-muted">до {formatDuration(MAX_VOICE_SECONDS)}</span>
            )}
          </div>
          <button
            type="button"
            onClick={voice.stop}
            disabled={voice.phase === 'starting'}
            aria-label="Спри записа"
            className={cn(roundButton, 'bg-red-500 text-white hover:bg-red-600')}
          >
            {voice.phase === 'starting' ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <Square className="size-4" fill="currentColor" aria-hidden />
            )}
          </button>
        </div>
      ) : voice.phase === 'preview' && voice.recording ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={voice.reset}
            disabled={pending}
            aria-label="Изтрий записа"
            className={cn(roundButton, 'text-muted hover:bg-field')}
          >
            <Trash2 className="size-5" aria-hidden />
          </button>
          <VoicePlayer
            src={voice.recording.url}
            durationSec={voice.recording.durationSec}
            className="h-12 flex-1 rounded-full bg-field py-1 pr-5 pl-1"
          />
          <button
            type="button"
            onClick={sendVoice}
            disabled={pending}
            aria-label="Изпрати гласовата бележка"
            className={cn(roundButton, 'bg-action text-white hover:bg-action-hover')}
          >
            {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Send className="size-5" aria-hidden />}
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendComment();
          }}
          className="flex items-end gap-2"
        >
          <label htmlFor="comment" className="sr-only">
            Нов коментар
          </label>
          <textarea
            id="comment"
            ref={ref}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void sendComment();
              }
            }}
            rows={1}
            placeholder={voiceEnabled ? 'Коментар или гласова бележка...' : 'Напишете коментар...'}
            className={cn(
              'min-h-12 flex-1 resize-none rounded-3xl border border-transparent bg-field px-4 py-3 text-base',
              'placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none sm:text-sm',
            )}
          />
          {comment.trim() || !voiceEnabled ? (
            <button
              type="submit"
              disabled={!comment.trim() || pending}
              aria-label="Добави коментара"
              className={cn(roundButton, 'bg-action text-white hover:bg-action-hover')}
            >
              {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Send className="size-5" aria-hidden />}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setError(null);
                void voice.start();
              }}
              aria-label="Запиши гласова бележка"
              className={cn(roundButton, 'bg-action text-white hover:bg-action-hover')}
            >
              <Mic className="size-5" aria-hidden />
            </button>
          )}
        </form>
      )}
    </div>
  );
});
