import { describe, expect, it } from 'vitest';
import { parseLeads } from '@/lib/leads/parse';
import { createRateLimiter } from './rate-limit';
import { intakeToRow } from './row';
import { intakeSchema, type IntakeLead } from './schema';

const valid = { name: 'Мария Тестова', phone: '0888 123 456', consent: true };

describe('intakeSchema', () => {
  it('normalises the phone and fills defaults', () => {
    const lead = intakeSchema.parse(valid);
    expect(lead).toMatchObject({ phone: '+359888123456', email: null, interest: '', message: '', source: 'форма' });
  });

  it('rejects a phone we could not call back', () => {
    const result = intakeSchema.safeParse({ ...valid, phone: '12' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/телефона/);
  });

  it('rejects a bad optional email but allows an empty one', () => {
    expect(intakeSchema.safeParse({ ...valid, email: 'nope' }).success).toBe(false);
    expect(intakeSchema.parse({ ...valid, email: '' }).email).toBeNull();
  });

  it('requires consent', () => {
    expect(intakeSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
  });

  it('flags a filled honeypot on the website field', () => {
    const result = intakeSchema.safeParse({ ...valid, website: 'http://spam' });
    expect(result.error?.issues[0].path[0]).toBe('website');
  });

  it('strips odd characters from the source tag', () => {
    expect(intakeSchema.parse({ ...valid, source: 'harmony<script>' }).source).toBe('harmonyscript');
  });
});

describe('intakeToRow', () => {
  const lead: IntakeLead = intakeSchema.parse({ ...valid, email: 'm@example.com', message: 'Апартамент', source: 'harmony' });
  const now = new Date('2026-09-16T12:00:00Z');

  it('fills matching columns and parses back to the same lead id', () => {
    const header = ['Date', 'E-Mail', 'Name', 'Phone Number', 'Съобщение', 'Източник', 'Notes'];
    const { row, id } = intakeToRow(header, lead, now);
    expect(row).toEqual([now.toISOString(), 'm@example.com', 'Мария Тестова', '+359888123456', 'Апартамент', 'harmony', '']);

    const [parsed] = parseLeads([header, row]);
    expect(parsed.id).toBe(id);
    expect(parsed.sheetNotes).toEqual([]);
    expect(parsed.answers).toEqual([
      { question: 'Съобщение', answer: 'Апартамент' },
      { question: 'Източник', answer: 'Harmony' },
    ]);
  });

  it('puts fields without a column into notes instead of dropping them', () => {
    const header = ['Date', 'Name', 'Phone Number', 'Notes'];
    const { row } = intakeToRow(header, lead, now);
    expect(row[3]).toBe('Съобщение: Апартамент · Източник: harmony');
  });

  it('works when the sheet has no notes column', () => {
    const { row } = intakeToRow(['Name', 'Phone'], lead, now);
    expect(row).toEqual(['Мария Тестова', '+359888123456', 'Съобщение: Апартамент · Източник: harmony']);
  });
});

describe('createRateLimiter', () => {
  it('allows up to the limit per key inside the window, then resets', () => {
    const allow = createRateLimiter(2, 1000);
    expect(allow('a', 0)).toBe(true);
    expect(allow('a', 10)).toBe(true);
    expect(allow('a', 20)).toBe(false);
    expect(allow('b', 20)).toBe(true);
    expect(allow('a', 1011)).toBe(true);
  });
});
