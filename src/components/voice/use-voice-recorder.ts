'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_VOICE_SECONDS } from '@/lib/audio/validation';

export type Recording = { blob: Blob; url: string; durationSec: number; mime: string };
type Phase = 'idle' | 'starting' | 'recording' | 'preview';

const MIME_PREFERENCE = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'];
const BARS = 36;

function pickMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return undefined;
  return MIME_PREFERENCE.find((type) => MediaRecorder.isTypeSupported(type));
}

function explainMicError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Няма разрешение за микрофона. Разрешете го от иконата до адреса на страницата и опитайте пак.';
  }
  if (name === 'NotFoundError') return 'Не е намерен микрофон.';
  if (name === 'NotReadableError') return 'Микрофонът се използва от друга програма.';
  return 'Записът не можа да започне. Опитайте пак.';
}

export function useVoiceRecorder() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0));
  const [recording, setRecording] = useState<Recording | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const discardRef = useRef(false);

  const release = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void contextRef.current?.close().catch(() => undefined);
    contextRef.current = null;
  }, []);

  const clearRecording = useCallback(() => {
    setRecording((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  }, []);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!window.isSecureContext) {
      setError('Гласовите бележки работят само през защитена връзка (https).');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Този браузър не поддържа запис на глас.');
      return;
    }

    setPhase('starting');
    clearRecording();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const mime = pickMime();
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = recorder;
      const chunks: Blob[] = [];
      discardRef.current = false;

      recorder.ondataavailable = (event) => event.data.size > 0 && chunks.push(event.data);
      recorder.onstop = () => {
        const durationSec = (performance.now() - startedAtRef.current) / 1000;
        release();
        if (discardRef.current || chunks.length === 0) {
          setPhase('idle');
          return;
        }
        const type = recorder.mimeType || mime || 'audio/webm';
        const blob = new Blob(chunks, { type });
        setRecording({ blob, url: URL.createObjectURL(blob), durationSec, mime: type });
        setPhase('preview');
      };

      // Level meter so people can see the microphone is actually picking them up.
      const context = new AudioContext();
      contextRef.current = context;
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      let lastTick = 0;

      const tick = (now: number) => {
        const seconds = (now - startedAtRef.current) / 1000;
        if (now - lastTick > 70) {
          lastTick = now;
          analyser.getByteTimeDomainData(samples);
          let sum = 0;
          for (const s of samples) sum += ((s - 128) / 128) ** 2;
          const level = Math.min(1, Math.sqrt(sum / samples.length) * 4);
          setLevels((prev) => [...prev.slice(1), level]);
          setElapsed(seconds);
        }
        if (seconds >= MAX_VOICE_SECONDS) {
          recorder.stop();
          return;
        }
        frameRef.current = requestAnimationFrame(tick);
      };

      startedAtRef.current = performance.now();
      recorder.start(250);
      setElapsed(0);
      setLevels(Array(BARS).fill(0));
      setPhase('recording');
      frameRef.current = requestAnimationFrame(tick);
    } catch (err) {
      release();
      setPhase('idle');
      setError(explainMicError(err));
    }
  }, [clearRecording, release]);

  const cancel = useCallback(() => {
    discardRef.current = true;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      release();
      setPhase('idle');
    }
    clearRecording();
  }, [clearRecording, release]);

  const reset = useCallback(() => {
    clearRecording();
    setPhase('idle');
  }, [clearRecording]);

  useEffect(
    () => () => {
      discardRef.current = true;
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      release();
    },
    [release],
  );

  return { phase, elapsed, levels, recording, error, clearError: () => setError(null), start, stop, cancel, reset };
}
