import { describe, expect, it, vi } from 'vitest';
import { DriveAudioStore } from './drive-audio-store';

const auth = { getAccessToken: async () => ({ token: 'tok' }) };
const config = { folderId: 'folder123', clientEmail: 'bot@project.iam.gserviceaccount.com' };

describe('DriveAudioStore', () => {
  it('uploads into the folder, in a shared drive, and returns the file id', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: 'file_abc_123456' })));
    const store = new DriveAudioStore(auth, config, fetchImpl as unknown as typeof fetch);

    const id = await store.save(Buffer.from('opus'), 'audio/webm;codecs=opus', 'note.webm');

    expect(id).toBe('file_abc_123456');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('uploadType=multipart');
    expect(url).toContain('supportsAllDrives=true');
    const body = (init.body as Buffer).toString();
    expect(body).toContain('"parents":["folder123"]');
    expect(body).toContain('Content-Type: audio/webm\r\n');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('explains the "no storage quota" error in plain words', async () => {
    const fetchImpl = async () =>
      new Response('{"error":{"errors":[{"reason":"storageQuotaExceeded"}]}}', { status: 403 });
    const store = new DriveAudioStore(auth, config, fetchImpl as unknown as typeof fetch);
    await expect(store.save(Buffer.from('x'), 'audio/webm', 'n.webm')).rejects.toThrow(/Shared drive/);
  });

  it('names the account to add when access is missing', async () => {
    const fetchImpl = async () => new Response('forbidden', { status: 403 });
    const store = new DriveAudioStore(auth, config, fetchImpl as unknown as typeof fetch);
    await expect(store.save(Buffer.from('x'), 'audio/webm', 'n.webm')).rejects.toThrow(config.clientEmail);
  });

  it('reads audio back with its content type', async () => {
    const fetchImpl = vi.fn(
      async () => new Response(Buffer.from('opus'), { headers: { 'content-type': 'audio/webm' } }),
    );
    const store = new DriveAudioStore(auth, config, fetchImpl as unknown as typeof fetch);
    const audio = await store.read('file_abc_123456');
    expect(audio?.mime).toBe('audio/webm');
    expect(audio?.data.toString()).toBe('opus');
  });

  it('returns null for missing files and never calls Drive with a suspicious id', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 404 }));
    const store = new DriveAudioStore(auth, config, fetchImpl as unknown as typeof fetch);
    expect(await store.read('file_abc_123456')).toBeNull();
    expect(await store.read('../x')).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
