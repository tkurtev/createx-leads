import { describe, expect, it, vi } from 'vitest';
import type { BlobApi } from './blob-api';
import { BlobActivityStore } from './blob-activity-store';
import { BlobAudioStore } from './blob-audio-store';

function memoryBlob(pageSize = 1000) {
  const files = new Map<string, { data: Buffer; contentType: string }>();
  const api: BlobApi = {
    put: vi.fn(async (pathname, body, { contentType }) => {
      files.set(pathname, { data: Buffer.from(body), contentType });
    }),
    list: vi.fn(async ({ prefix, cursor }) => {
      const all = [...files.keys()].filter((p) => p.startsWith(prefix)).sort();
      const start = cursor ? Number(cursor) : 0;
      const slice = all.slice(start, start + pageSize);
      const hasMore = start + pageSize < all.length;
      return { blobs: slice.map((pathname) => ({ pathname })), hasMore, cursor: hasMore ? String(start + pageSize) : undefined };
    }),
    get: vi.fn(async (pathname) => files.get(pathname) ?? null),
  };
  return { api, files };
}

describe('BlobActivityStore', () => {
  it('reads leads from the fixture reader', async () => {
    const { api } = memoryBlob();
    const store = new BlobActivityStore(async () => [['Name'], ['A']], api);
    expect(await store.readLeadRows()).toEqual([['Name'], ['A']]);
  });

  it('appends as private JSON blobs and reads them back in order', async () => {
    const { api } = memoryBlob();
    const store = new BlobActivityStore(async () => [], api);
    await store.appendActivity({ leadId: 'l1', author: 'A', type: 'comment', text: 'първи' });
    await new Promise((r) => setTimeout(r, 5));
    await store.appendActivity({ leadId: 'l1', author: 'B', type: 'comment', text: 'втори' });

    const fresh = new BlobActivityStore(async () => [], api);
    expect((await fresh.readActivity()).map((a) => a.text)).toEqual(['първи', 'втори']);
  });

  it('fetches each entry only once per instance', async () => {
    const { api } = memoryBlob();
    const writer = new BlobActivityStore(async () => [], api);
    await writer.appendActivity({ leadId: 'l1', author: 'A', type: 'comment', text: 'x' });

    const reader = new BlobActivityStore(async () => [], api);
    await reader.readActivity();
    await reader.readActivity();
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('follows list pagination', async () => {
    const { api } = memoryBlob(2);
    const store = new BlobActivityStore(async () => [], api);
    for (let i = 0; i < 5; i++) await store.appendActivity({ leadId: 'l1', author: 'A', type: 'comment', text: String(i) });
    const reader = new BlobActivityStore(async () => [], api);
    expect(await reader.readActivity()).toHaveLength(5);
  });

  it('skips corrupt files instead of failing', async () => {
    const { api, files } = memoryBlob();
    files.set('activity/broken.json', { data: Buffer.from('{nope'), contentType: 'application/json' });
    const store = new BlobActivityStore(async () => [], api);
    expect(await store.readActivity()).toEqual([]);
  });
});

describe('BlobAudioStore', () => {
  it('saves audio without codec parameters in the content type and reads it back', async () => {
    const { api, files } = memoryBlob();
    const store = new BlobAudioStore(api);
    const id = await store.save(Buffer.from('opus'), 'audio/webm;codecs=opus');
    expect(files.get(`audio/${id}`)?.contentType).toBe('audio/webm');
    expect(await store.read(id)).toEqual({ data: Buffer.from('opus'), mime: 'audio/webm' });
  });

  it('rejects unknown and suspicious ids', async () => {
    const { api } = memoryBlob();
    const store = new BlobAudioStore(api);
    expect(await store.read('00000000-0000-0000-0000-000000000000')).toBeNull();
    expect(await store.read('../secret')).toBeNull();
  });
});

describe('BlobActivityStore leads from the web form', () => {
  it('appends submitted rows after the fixture rows', async () => {
    const { api } = memoryBlob();
    const store = new BlobActivityStore(async () => [['Name', 'Phone'], ['Fixture', '0888000000']], api);
    await store.appendLeadRow(['Нов', '+359888123456']);
    const fresh = new BlobActivityStore(async () => [['Name', 'Phone'], ['Fixture', '0888000000']], api);
    expect(await fresh.readLeadRows()).toEqual([['Name', 'Phone'], ['Fixture', '0888000000'], ['Нов', '+359888123456']]);
    expect(await fresh.readActivity()).toEqual([]);
  });
});
