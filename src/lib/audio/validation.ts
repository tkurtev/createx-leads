export const MAX_VOICE_SECONDS = 180;
export const MAX_VOICE_BYTES = 8 * 1024 * 1024;

const ALLOWED = /^audio\/(webm|mp4|ogg|mpeg|x-m4a|aac|wav)(;.*)?$/i;

export type VoiceUpload = { size: number; type: string; durationSec: number };

/** Returns a message the person recording can act on, or null when the upload is fine. */
export function voiceUploadProblem(upload: VoiceUpload): string | null {
  if (upload.size === 0) return 'Записът е празен. Опитайте пак.';
  if (upload.size > MAX_VOICE_BYTES) return 'Записът е твърде голям (до 8 MB).';
  if (!ALLOWED.test(upload.type)) return 'Този аудио формат не се поддържа.';
  if (!Number.isFinite(upload.durationSec) || upload.durationSec <= 0) return 'Записът е твърде кратък.';
  if (upload.durationSec > MAX_VOICE_SECONDS + 2) return 'Гласовата бележка може да е до 3 минути.';
  return null;
}

export function extensionFor(mime: string): string {
  if (/mp4|m4a|aac/i.test(mime)) return 'm4a';
  if (/ogg/i.test(mime)) return 'ogg';
  if (/mpeg/i.test(mime)) return 'mp3';
  if (/wav/i.test(mime)) return 'wav';
  return 'webm';
}

/** Safari only plays media from servers that honour Range requests. */
export function parseRange(header: string | null, size: number): { start: number; end: number } | null {
  if (!header) return null;
  const match = header.match(/^bytes=(\d*)-(\d*)$/);
  if (!match || (match[1] === '' && match[2] === '')) return null;
  let start: number;
  let end: number;
  if (match[1] === '') {
    start = Math.max(0, size - Number(match[2]));
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  if (start > end || start >= size) return null;
  return { start, end };
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
