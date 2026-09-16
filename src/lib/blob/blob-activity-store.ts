import type { Activity } from '@/lib/leads/types';
import { buildActivity } from '@/lib/store/activity-rows';
import type { LeadStore, NewActivity } from '@/lib/store/types';
import type { BlobApi } from './blob-api';

const ACTIVITY_PREFIX = 'activity/';
const LEADS_PREFIX = 'leads/';

/**
 * Demo deployments: leads come from the bundled fixture plus any submitted
 * through the web form, and every comment, call or voice note is its own
 * private blob. Entries are never edited, so each one is fetched once per
 * server instance and then cached.
 */
export class BlobActivityStore implements LeadStore {
  private readonly cache = new Map<string, unknown>();

  constructor(
    private readonly readRows: () => Promise<string[][]>,
    private readonly blob: BlobApi,
  ) {}

  /** Every JSON blob under the prefix, in name order (names start with a timestamp). */
  private async readAll<T>(prefix: string): Promise<T[]> {
    const pathnames: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.blob.list({ prefix, cursor });
      pathnames.push(...page.blobs.map((b) => b.pathname));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    pathnames.sort();

    const missing = pathnames.filter((p) => !this.cache.has(p));
    await Promise.all(
      missing.map(async (pathname) => {
        const file = await this.blob.get(pathname);
        if (!file) return;
        try {
          this.cache.set(pathname, JSON.parse(file.data.toString('utf8')));
        } catch {
          // A half-written or foreign file in the prefix: skip it rather than break the app.
        }
      }),
    );

    return pathnames.map((p) => this.cache.get(p) as T | undefined).filter((v): v is T => v !== undefined);
  }

  private async write(prefix: string, at: string, id: string, value: unknown) {
    const pathname = `${prefix}${at.replace(/[:.]/g, '-')}_${id}.json`;
    await this.blob.put(pathname, JSON.stringify(value), { contentType: 'application/json' });
    this.cache.set(pathname, value);
  }

  async readLeadRows() {
    const [fixture, submitted] = await Promise.all([this.readRows(), this.readAll<string[]>(LEADS_PREFIX)]);
    return [...fixture, ...submitted.filter(Array.isArray)];
  }

  async appendLeadRow(row: string[]) {
    await this.write(LEADS_PREFIX, new Date().toISOString(), Math.random().toString(36).slice(2, 8), row);
  }

  readActivity() {
    return this.readAll<Activity>(ACTIVITY_PREFIX);
  }

  async appendActivity(input: NewActivity): Promise<Activity> {
    const activity = buildActivity(input);
    await this.write(ACTIVITY_PREFIX, activity.at, activity.id, activity);
    return activity;
  }
}
