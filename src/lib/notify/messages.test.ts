import { describe, expect, it } from 'vitest';
import { intakeSchema } from '@/lib/intake/schema';
import { callReportEmail, leadUrl, newLeadEmail } from './messages';

describe('notification emails', () => {
  it('escapes what the lead typed', () => {
    const lead = intakeSchema.parse({ name: '<b>Хакер</b>', phone: '0888123456', consent: true });
    const email = newLeadEmail(lead, leadUrl('https://app.test', 'l_1'));
    expect(email.html).toContain('&lt;b&gt;Хакер&lt;/b&gt;');
    expect(email.html).not.toContain('<b>Хакер');
    expect(email.text).toContain('Телефон: +359 88 812 3456');
    expect(email.text).not.toContain('Имейл');
  });

  it('summarises a call with its outcome and length', () => {
    const email = callReportEmail(
      { leadName: 'Иван', summary: 'Иска оглед в събота', outcome: 'booked', durationSec: 95 },
      'https://app.test/?lead=l_1',
    );
    expect(email.subject).toBe('AI обаждане до Иван: Записан');
    expect(email.text).toContain('Продължителност: 1.6 мин.');
  });
});
