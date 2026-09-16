import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileAudioStore } from './file-audio-store';

describe('FileAudioStore', () => {
  const store = new FileAudioStore(path.join(mkdtempSync(path.join(tmpdir(), 'cx-audio-')), 'audio'));

  it('saves and reads back audio with its type', async () => {
    const id = await store.save(Buffer.from('fake-opus'), 'audio/webm');
    const audio = await store.read(id);
    expect(audio?.mime).toBe('audio/webm');
    expect(audio?.data.toString()).toBe('fake-opus');
  });

  it('returns null for unknown ids', async () => {
    expect(await store.read('00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('refuses ids that could escape the folder', async () => {
    expect(await store.read('../../etc/passwd')).toBeNull();
  });
});
