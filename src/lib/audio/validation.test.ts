import { describe, expect, it } from 'vitest';
import { extensionFor, formatDuration, MAX_VOICE_BYTES, parseRange, voiceUploadProblem } from './validation';

describe('voiceUploadProblem', () => {
  const ok = { size: 20_000, type: 'audio/webm;codecs=opus', durationSec: 12 };

  it('accepts Chrome and Safari recordings', () => {
    expect(voiceUploadProblem(ok)).toBeNull();
    expect(voiceUploadProblem({ ...ok, type: 'audio/mp4' })).toBeNull();
  });

  it('rejects empty, oversized, non-audio and too long uploads', () => {
    expect(voiceUploadProblem({ ...ok, size: 0 })).toMatch(/празен/);
    expect(voiceUploadProblem({ ...ok, size: MAX_VOICE_BYTES + 1 })).toMatch(/голям/);
    expect(voiceUploadProblem({ ...ok, type: 'video/webm' })).toMatch(/формат/);
    expect(voiceUploadProblem({ ...ok, type: 'text/html' })).toMatch(/формат/);
    expect(voiceUploadProblem({ ...ok, durationSec: 0 })).toMatch(/кратък/);
    expect(voiceUploadProblem({ ...ok, durationSec: Number.NaN })).toMatch(/кратък/);
    expect(voiceUploadProblem({ ...ok, durationSec: 400 })).toMatch(/3 минути/);
  });
});

describe('extensionFor', () => {
  it('maps recorder mime types to file extensions', () => {
    expect(extensionFor('audio/webm;codecs=opus')).toBe('webm');
    expect(extensionFor('audio/mp4')).toBe('m4a');
    expect(extensionFor('audio/ogg;codecs=opus')).toBe('ogg');
  });
});

describe('parseRange', () => {
  it('handles open, closed and suffix ranges', () => {
    expect(parseRange('bytes=0-1', 100)).toEqual({ start: 0, end: 1 });
    expect(parseRange('bytes=50-', 100)).toEqual({ start: 50, end: 99 });
    expect(parseRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange('bytes=90-500', 100)).toEqual({ start: 90, end: 99 });
  });

  it('returns null for missing or unsatisfiable ranges', () => {
    expect(parseRange(null, 100)).toBeNull();
    expect(parseRange('bytes=-', 100)).toBeNull();
    expect(parseRange('bytes=200-300', 100)).toBeNull();
    expect(parseRange('items=0-1', 100)).toBeNull();
  });
});

describe('formatDuration', () => {
  it('formats as m:ss', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(7.4)).toBe('0:07');
    expect(formatDuration(65)).toBe('1:05');
  });
});
