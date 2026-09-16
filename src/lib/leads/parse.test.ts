import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectColumns, leadId, parseLeads } from './parse';

const demo = JSON.parse(
  readFileSync(path.join(__dirname, '../../../fixtures/messy-sheet.json'), 'utf8'),
) as string[][];

describe('detectColumns', () => {
  it('finds contact columns and treats the rest before Notes as questions', () => {
    const cols = detectColumns(demo[0]);
    expect(cols).toMatchObject({ date: 0, email: 3, name: 4, phone: 5, notes: 6, questions: [1, 2] });
  });

  it('falls back to "no notes" when the column is missing', () => {
    const cols = detectColumns(['Created', 'Full name', 'Email', 'Телефон']);
    expect(cols).toMatchObject({ date: 0, name: 1, email: 2, phone: 3, notes: 4, questions: [] });
  });
});

describe('parseLeads', () => {
  const leads = parseLeads(demo);

  it('skips rows nobody can be contacted on', () => {
    expect(leads.map((l) => l.name)).not.toContain('Без име');
    expect(leads).toHaveLength(5);
  });

  it('sorts newest first', () => {
    expect(leads[0].name).toBe('Георги Демов');
    const dates = leads.map((l) => l.createdAt ?? '');
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('normalises contact details and keeps the sheet row', () => {
    const ivan = leads.find((l) => l.name === 'Ivan Testov')!;
    expect(ivan).toMatchObject({ phone: '+359899000303', email: 'demo.ivan@example.com', row: 4 });
  });

  it('collects every note column after Notes, ignoring blanks', () => {
    const ivan = leads.find((l) => l.name === 'Ivan Testov')!;
    expect(ivan.sheetNotes).toEqual(['ще прати панорамна снимка', 'не вдига']);
  });

  it('humanises form answers and drops empty ones', () => {
    const maria = leads.find((l) => l.name === 'Мария Примерова')!;
    expect(maria.answers).toEqual([
      { question: 'От какво лечение имате нужда?', answer: 'Възстановяване на единичен зъб' },
      { question: 'Предлагаме само цяла челюст на невероятна цена', answer: 'Добре, искам да науча повече' },
    ]);
  });

  it('recovers a row pasted into a single tab-separated cell', () => {
    const petar = leads.find((l) => l.email === 'demo.petar@example.com')!;
    expect(petar.name).toBe('Petar');
    expect(petar.createdAt).not.toBeNull();
    expect(petar.sheetNotes).toEqual(['дадох адрес за томограф']);
  });

  it('keeps ids stable when rows move', () => {
    const [header, ...body] = demo;
    const shuffled = parseLeads([header, ['', '', '', 'x@example.com', 'X', ''], ...body]);
    const byName = (list: typeof leads) => Object.fromEntries(list.map((l) => [l.name, l.id]));
    expect(byName(shuffled)['Георги Демов']).toBe(byName(leads)['Георги Демов']);
  });

  it('disambiguates exact duplicates', () => {
    const [header, row] = demo;
    const ids = parseLeads([header, row, row]).map((l) => l.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('handles empty input', () => {
    expect(parseLeads([])).toEqual([]);
    expect(parseLeads([demo[0]])).toEqual([]);
  });
});

describe('leadId', () => {
  it('falls back to the row when there is no contact', () => {
    expect(leadId(null, null, null, 7)).toBe(leadId(null, null, null, 7));
    expect(leadId(null, null, null, 7)).not.toBe(leadId(null, null, null, 8));
  });
});
