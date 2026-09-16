import type { TokenSource } from '@/lib/google/auth';
import type { Activity } from '@/lib/leads/types';
import { ACTIVITY_COLUMNS, ACTIVITY_HEADER, activityToRow, buildActivity, rowToActivity } from './activity-rows';
import type { LeadStore, NewActivity } from './types';

const API = 'https://sheets.googleapis.com/v4/spreadsheets';

type SheetsConfig = {
  spreadsheetId: string;
  leadsTab: string;
  activityTab: string;
  clientEmail: string;
};

/**
 * Leads are read from the tab the ads integration writes to. Comments, calls
 * and emails go to a separate tab, so the app never edits a lead row.
 */
export class SheetsStore implements LeadStore {
  private activityTabReady = false;

  constructor(
    private readonly auth: TokenSource,
    private readonly config: SheetsConfig,
  ) {}

  private async request<T>(url: string, init?: RequestInit): Promise<T> {
    const { token } = await this.auth.getAccessToken();
    const response = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) {
      const body = await response.text();
      if (response.status === 403) {
        throw new Error(
          `Google Sheets отказа достъп. Споделете таблицата с ${this.config.clientEmail} като редактор.`,
        );
      }
      throw new Error(`Google Sheets върна ${response.status}: ${body.slice(0, 200)}`);
    }
    return (await response.json()) as T;
  }

  private range(tab: string, cells: string) {
    return encodeURIComponent(`'${tab.replace(/'/g, "''")}'!${cells}`);
  }

  private async readRange(tab: string, cells: string): Promise<string[][]> {
    const url = `${API}/${this.config.spreadsheetId}/values/${this.range(tab, cells)}`;
    const data = await this.request<{ values?: string[][] }>(url);
    return data.values ?? [];
  }

  async readLeadRows() {
    return this.readRange(this.config.leadsTab, 'A:ZZ');
  }

  async appendLeadRow(row: string[]) {
    const url =
      `${API}/${this.config.spreadsheetId}/values/${this.range(this.config.leadsTab, 'A:ZZ')}` +
      ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS';
    await this.request(url, { method: 'POST', body: JSON.stringify({ values: [row] }) });
  }

  private async ensureActivityTab() {
    if (this.activityTabReady) return;
    const meta = await this.request<{ sheets: { properties: { title: string } }[] }>(
      `${API}/${this.config.spreadsheetId}?fields=sheets.properties.title`,
    );
    const exists = meta.sheets.some((s) => s.properties.title === this.config.activityTab);
    if (!exists) {
      await this.request(`${API}/${this.config.spreadsheetId}:batchUpdate`, {
        method: 'POST',
        body: JSON.stringify({
          requests: [{ addSheet: { properties: { title: this.config.activityTab } } }],
        }),
      });
      await this.appendRows([ACTIVITY_HEADER]);
    } else {
      // Tabs created before voice notes have a shorter header row: extend it in place.
      const [header = []] = await this.readRange(this.config.activityTab, '1:1');
      if (header.length < ACTIVITY_HEADER.length) {
        const url =
          `${API}/${this.config.spreadsheetId}/values/${this.range(this.config.activityTab, 'A1')}` +
          '?valueInputOption=RAW';
        await this.request(url, { method: 'PUT', body: JSON.stringify({ values: [ACTIVITY_HEADER] }) });
      }
    }
    this.activityTabReady = true;
  }

  private async appendRows(rows: string[][]) {
    const url =
      `${API}/${this.config.spreadsheetId}/values/${this.range(this.config.activityTab, ACTIVITY_COLUMNS)}` +
      ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS';
    await this.request(url, { method: 'POST', body: JSON.stringify({ values: rows }) });
  }

  async readActivity(): Promise<Activity[]> {
    await this.ensureActivityTab();
    const rows = await this.readRange(this.config.activityTab, ACTIVITY_COLUMNS.replace('A:', 'A2:'));
    return rows.map(rowToActivity).filter((a): a is Activity => a !== null);
  }

  async appendActivity(input: NewActivity): Promise<Activity> {
    await this.ensureActivityTab();
    const activity = buildActivity(input);
    await this.appendRows([activityToRow(activity, input.leadName)]);
    return activity;
  }
}
