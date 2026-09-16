import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { AudioStore, StoredAudio } from './types';

const ID_RE = /^[a-f0-9-]{36}$/;

/** Local development: audio files on disk next to the activity JSON. */
export class FileAudioStore implements AudioStore {
  constructor(private readonly dir: string) {}

  async save(data: Buffer, mime: string): Promise<string> {
    const id = randomUUID();
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(path.join(this.dir, `${id}.bin`), data);
    await fs.writeFile(path.join(this.dir, `${id}.json`), JSON.stringify({ mime }));
    return id;
  }

  async read(id: string): Promise<StoredAudio | null> {
    if (!ID_RE.test(id)) return null;
    try {
      const [data, meta] = await Promise.all([
        fs.readFile(path.join(this.dir, `${id}.bin`)),
        fs.readFile(path.join(this.dir, `${id}.json`), 'utf8'),
      ]);
      return { data, mime: (JSON.parse(meta) as { mime: string }).mime };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }
}
