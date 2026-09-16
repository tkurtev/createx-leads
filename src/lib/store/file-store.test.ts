import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileStore } from './file-store';

describe('FileStore', () => {
  it('reads rows, starts with no activity and appends', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'cx-leads-'));
    const leadsFile = path.join(dir, 'leads.json');
    writeFileSync(leadsFile, JSON.stringify([['Name'], ['A']]));
    const store = new FileStore(leadsFile, path.join(dir, 'nested', 'activity.json'));

    expect(await store.readLeadRows()).toEqual([['Name'], ['A']]);
    expect(await store.readActivity()).toEqual([]);

    await store.appendActivity({ leadId: 'l1', author: 'A', type: 'comment', text: 'първи' });
    await store.appendActivity({ leadId: 'l1', author: 'B', type: 'comment', text: 'втори' });
    expect((await store.readActivity()).map((a) => a.text)).toEqual(['първи', 'втори']);

    await store.appendLeadRow(['B']);
    expect(await store.readLeadRows()).toEqual([['Name'], ['A'], ['B']]);
  });

  it('surfaces a missing leads file', async () => {
    const store = new FileStore('/nope/leads.json', '/nope/activity.json');
    await expect(store.readLeadRows()).rejects.toThrow();
  });
});
