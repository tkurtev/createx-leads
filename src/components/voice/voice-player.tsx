'use client';

import { Loader2, Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatDuration } from '@/lib/audio/validation';
import { cn } from '@/lib/cn';

type Props = { src: string; durationSec: number; className?: string };

export function VoicePlayer({ src, durationSec, className }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [failed, setFailed] = useState(false);

  // Recorder output often has no duration header (Infinity), so trust the stored length.
  const total = durationSec > 0 ? durationSec : 0;
  const progress = total > 0 ? Math.min(1, position / total) : 0;

  useEffect(() => {
    const audio = audioRef.current;
    return () => audio?.pause();
  }, []);

  async function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      return;
    }
    setFailed(false);
    setLoading(true);
    try {
      await audio.play();
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  function seek(event: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || total === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * total;
    setPosition(ratio * total);
  }

  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setPosition(0);
        }}
        onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
        onError={() => {
          setFailed(true);
          setPlaying(false);
          setLoading(false);
        }}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Пауза' : 'Пусни гласовата бележка'}
        className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-action text-white transition-colors hover:bg-action-hover"
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : playing ? (
          <Pause className="size-4" fill="currentColor" aria-hidden />
        ) : (
          <Play className="ml-0.5 size-4" fill="currentColor" aria-hidden />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div
          role="slider"
          tabIndex={0}
          aria-label="Позиция в записа"
          aria-valuemin={0}
          aria-valuemax={Math.round(total)}
          aria-valuenow={Math.round(position)}
          onClick={seek}
          onKeyDown={(e) => {
            const audio = audioRef.current;
            if (!audio || total === 0) return;
            if (e.key === 'ArrowRight') audio.currentTime = Math.min(total, audio.currentTime + 5);
            if (e.key === 'ArrowLeft') audio.currentTime = Math.max(0, audio.currentTime - 5);
          }}
          className="relative h-6 cursor-pointer"
        >
          <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-border" />
          <div
            className="absolute top-1/2 left-0 h-1.5 -translate-y-1/2 rounded-full bg-action"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <p className="text-xs tabular-nums text-muted">
          {failed ? (
            <span className="text-red-700">Записът не може да се пусне в този браузър.</span>
          ) : (
            <>
              {formatDuration(position)} / {formatDuration(total)}
            </>
          )}
        </p>
      </div>
    </div>
  );
}
