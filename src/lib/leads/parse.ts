import { humanize, normalizeEmail, normalizePhone, parseDate } from './normalize';
import type { Answer, Lead } from './types';

type Columns = {
  date: number;
  email: number;
  name: number;
  phone: number;
  notes: number;
  questions: number[];
};

const match = (header: string, patterns: RegExp[]) =>
  patterns.some((p) => p.test(header.trim()));

export function detectColumns(header: string[]): Columns {
  const find = (patterns: RegExp[]) => header.findIndex((h) => match(h ?? '', patterns));

  const date = find([/^date$/i, /created/i, /дата/i]);
  const email = find([/e-?mail/i, /имейл/i]);
  const name = find([/^(full[_ ]?)?name$/i, /^име/i]);
  const phone = find([/phone/i, /телефон/i]);
  const notesAt = find([/^notes?$/i, /бележк/i, /коментар/i]);
  const notes = notesAt === -1 ? header.length : notesAt;

  const known = new Set([date, email, name, phone]);
  const questions = header
    .map((_, i) => i)
    .filter((i) => i < notes && !known.has(i) && (header[i] ?? '').trim() !== '');

  return { date, email, name, phone, notes, questions };
}

const cell = (row: string[], index: number) => (index >= 0 ? (row[index] ?? '').trim() : '');

/**
 * A row pasted from another export lands in one cell, tab separated:
 * "2023-10-11 13:25:30\tdemo.petar@example.com\tPetar". Pull the pieces back out.
 */
function unpackTabbedRow(row: string[]) {
  const packed = row.find((value) => value?.includes('\t'));
  if (!packed) return null;
  const parts = packed.split('\t').map((p) => p.trim()).filter(Boolean);
  const email = parts.find((p) => normalizeEmail(p));
  const date = parts.find((p) => parseDate(p));
  const phone = parts.find((p) => normalizePhone(p));
  const name = parts.find((p) => p !== email && p !== date && p !== phone);
  return { email, date, phone, name };
}

/** Stable across row inserts: identity comes from the lead, not its position. */
export function leadId(email: string | null, phone: string | null, createdAt: string | null, row: number) {
  const key = email ?? phone ?? `row-${row}`;
  const source = createdAt ? `${key}|${createdAt}` : key;
  let hash = 5381;
  for (let i = 0; i < source.length; i++) hash = ((hash << 5) + hash + source.charCodeAt(i)) >>> 0;
  return `l_${hash.toString(36)}`;
}

export function parseLeads(rows: string[][]): Lead[] {
  if (rows.length === 0) return [];
  const [header, ...body] = rows;
  const cols = detectColumns(header);
  const seen = new Map<string, number>();
  const leads: Lead[] = [];

  body.forEach((row, index) => {
    const sheetRow = index + 2;
    const tabbed = unpackTabbedRow(row);
    const rawEmail = tabbed?.email ?? cell(row, cols.email);
    const rawPhone = tabbed?.phone ?? cell(row, cols.phone);
    const email = normalizeEmail(rawEmail);
    const phone = normalizePhone(rawPhone);

    // Rows with no way to reach anyone are scratch notes or call scripts, not leads.
    if (!email && !phone) return;

    const createdAt = parseDate(tabbed?.date ?? cell(row, cols.date));
    const name = (tabbed?.name ?? cell(row, cols.name)) || email || 'Без име';

    const answers: Answer[] = cols.questions
      .map((i) => ({ question: humanize(header[i]), answer: humanize(cell(row, i)) }))
      .filter((a) => a.answer !== '');

    const sheetNotes = row
      .slice(cols.notes)
      .map((n) => (n ?? '').trim())
      .filter((n) => n !== '' && !n.includes('\t'));

    let id = leadId(email, phone, createdAt, sheetRow);
    const dupes = seen.get(id) ?? 0;
    seen.set(id, dupes + 1);
    if (dupes > 0) id = `${id}_${dupes}`;

    leads.push({ id, row: sheetRow, createdAt, name, email, phone, rawPhone, answers, sheetNotes });
  });

  return leads.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}
