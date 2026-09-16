import { describe, expect, it } from 'vitest';
import { emailTemplates } from './templates';

describe('emailTemplates', () => {
  const templates = emailTemplates({ leadName: 'Мария Иванова', userName: 'Иван' });

  it('greets by first name and signs with the sender', () => {
    for (const t of templates) {
      expect(t.body.startsWith('Здравейте, Мария,')).toBe(true);
      expect(t.body.endsWith('Иван')).toBe(true);
      expect(t.subject.length).toBeGreaterThan(0);
    }
  });

  it('has unique ids', () => {
    expect(new Set(templates.map((t) => t.id)).size).toBe(templates.length);
  });
});
