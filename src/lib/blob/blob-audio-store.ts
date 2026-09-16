import { randomUUID } from 'node:crypto';
import type { AudioStore, StoredAudio } from '@/lib/audio/types';
import type { BlobApi } from './blob-api';

const ID_RE = /^[a-f0-9-]{36}$/;

export class BlobAudioStore implements AudioStore {
  constructor(private readonly blob: BlobApi) {}

  async save(data: Buffer, mime: string): Promise<string> {
    const id = randomUUID();
    await this.blob.put(`audio/${id}`, data, { contentType: mime.split(';')[0] });
    return id;
  }

  async read(id: string): Promise<StoredAudio | null> {
    if (!ID_RE.test(id)) return null;
    const file = await this.blob.get(`audio/${id}`);
    return file ? { data: file.data, mime: file.contentType } : null;
  }
}
