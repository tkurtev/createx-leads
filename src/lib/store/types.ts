import type { Activity } from '@/lib/leads/types';

export type NewActivity = Omit<Activity, 'id' | 'at'> & { leadName?: string };

export interface LeadStore {
  /** Raw rows of the leads tab, header first */
  readLeadRows(): Promise<string[][]>;
  /** Adds a lead that came in through the web form, shaped like the rows above */
  appendLeadRow(row: string[]): Promise<void>;
  readActivity(): Promise<Activity[]>;
  appendActivity(activity: NewActivity): Promise<Activity>;
}
