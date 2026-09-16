import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Activity } from '@/lib/leads/types';
import { buildActivity } from './activity-rows';
import type { LeadStore, NewActivity } from './types';

/**
 * Local development store: leads from a JSON file of sheet rows, activity in a
 * JSON file next to it. Never used in production.
 */
export class FileStore implements LeadStore {
  constructor(
    private readonly leadsFile: string,
    private readonly activityFile: string,
  ) {}

  async readLeadRows(): Promise<string[][]> {
    return JSON.parse(await fs.readFile(this.leadsFile, 'utf8')) as string[][];
  }

  async appendLeadRow(row: string[]) {
    const rows = await this.readLeadRows();
    await fs.writeFile(this.leadsFile, JSON.stringify([...rows, row], null, 1));
  }

  async readActivity(): Promise<Activity[]> {
    try {
      return JSON.parse(await fs.readFile(this.activityFile, 'utf8')) as Activity[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }

  async appendActivity(input: NewActivity): Promise<Activity> {
    const activity = buildActivity(input);
    const all = await this.readActivity();
    await fs.mkdir(path.dirname(this.activityFile), { recursive: true });
    await fs.writeFile(this.activityFile, JSON.stringify([...all, activity], null, 2));
    return activity;
  }
}
