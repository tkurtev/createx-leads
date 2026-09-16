import { detectColumns, leadId } from '@/lib/leads/parse';
import { humanize } from '@/lib/leads/normalize';
import type { IntakeLead } from './schema';

/** Optional form fields, written to a sheet column with this header when there is one. */
const EXTRA_FIELDS = [
  { label: 'Интерес', key: 'interest' },
  { label: 'Съобщение', key: 'message' },
  { label: 'Източник', key: 'source' },
] as const;

/**
 * Turns a form submission into a row shaped like the leads tab, so the sheet
 * integration, the demo store and the parser all treat it as any other lead.
 * Fields without a matching column go into the notes column instead of being lost.
 */
export function intakeToRow(header: string[], lead: IntakeLead, now = new Date()) {
  const cols = detectColumns(header);
  const createdAt = now.toISOString();
  const row = Array.from({ length: Math.max(header.length, cols.notes) }, () => '');
  const set = (index: number, value: string) => {
    if (index >= 0) row[index] = value;
  };

  set(cols.date, createdAt);
  set(cols.name, lead.name);
  set(cols.phone, lead.phone);
  set(cols.email, lead.email ?? '');

  const leftovers: string[] = [];
  for (const { label, key } of EXTRA_FIELDS) {
    const value = lead[key];
    if (!value) continue;
    const index = header.findIndex((h) => humanize(h ?? '').toLowerCase() === label.toLowerCase());
    if (index >= 0 && index < cols.notes) set(index, value);
    else leftovers.push(`${label}: ${value}`);
  }
  if (leftovers.length > 0) row[cols.notes] = leftovers.join(' · ');

  return { row, createdAt, id: leadId(lead.email, lead.phone, createdAt, 0) };
}
