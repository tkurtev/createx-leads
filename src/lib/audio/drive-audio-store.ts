import type { TokenSource } from '@/lib/google/auth';
import type { AudioStore, StoredAudio } from './types';

const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FILES = 'https://www.googleapis.com/drive/v3/files';
const ID_RE = /^[A-Za-z0-9_-]{10,}$/;

type Config = { folderId: string; clientEmail: string };

/**
 * Voice notes as files in a Google Drive folder. The folder must live in a
 * Shared drive: service accounts have no storage of their own, so uploads to
 * a normal "My Drive" folder are rejected by Google.
 */
export class DriveAudioStore implements AudioStore {
  constructor(
    private readonly auth: TokenSource,
    private readonly config: Config,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async token() {
    const { token } = await this.auth.getAccessToken();
    if (!token) throw new Error('Няма достъп до Google. Проверете ключа на service account.');
    return token;
  }

  private async explain(response: Response): Promise<never> {
    const body = await response.text();
    if (/storageQuotaExceeded|do not have storage quota/i.test(body)) {
      throw new Error('Папката за гласови бележки трябва да е в споделен диск (Shared drive) в Google Drive.');
    }
    if (response.status === 404 || response.status === 403) {
      throw new Error(
        `Няма достъп до папката за гласови бележки. Добавете ${this.config.clientEmail} към споделения диск.`,
      );
    }
    throw new Error(`Google Drive върна ${response.status}: ${body.slice(0, 200)}`);
  }

  async save(data: Buffer, mime: string, name: string): Promise<string> {
    const boundary = `cx${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
    const metadata = JSON.stringify({ name, parents: [this.config.folderId], mimeType: mime.split(';')[0] });
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Type: ${mime.split(';')[0]}\r\n\r\n`),
      data,
      Buffer.from(`\r\n--${boundary}--`),
    ]);

    const response = await this.fetchImpl(`${UPLOAD}?uploadType=multipart&supportsAllDrives=true&fields=id`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await this.token()}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    });
    if (!response.ok) return this.explain(response);
    return ((await response.json()) as { id: string }).id;
  }

  async read(id: string): Promise<StoredAudio | null> {
    if (!ID_RE.test(id)) return null;
    const response = await this.fetchImpl(`${FILES}/${id}?alt=media&supportsAllDrives=true`, {
      headers: { Authorization: `Bearer ${await this.token()}` },
      cache: 'no-store',
    });
    if (response.status === 404) return null;
    if (!response.ok) return this.explain(response);
    return {
      data: Buffer.from(await response.arrayBuffer()),
      mime: response.headers.get('content-type') ?? 'audio/webm',
    };
  }
}
