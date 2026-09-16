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

  it('summarises a call with its outcome, qualification and what was learned', () => {
    const email = callReportEmail(
      {
        leadName: 'Иван',
        status: 'booked',
        call: {
          provider: 'vapi',
          state: 'ended',
          reached: true,
          durationSec: 95,
          summary: 'Уговорена среща за четвъртък.',
          qualification: 'hot',
          nextSteps: ['Изпрати оферта по имейл'],
          facts: [{ label: 'Бюджет', value: 'до 5000 лв' }],
          transcript: [{ role: 'agent', text: 'Добър ден' }],
        },
      },
      'https://app.test/?lead=l_1',
    );
    expect(email.subject).toBe('AI обаждане до Иван: Записан');
    expect(email.text).toContain('Продължителност: 1:35 мин.');
    expect(email.text).toContain('Квалификация: Горещ');
    expect(email.text).toContain('• Изпрати оферта по имейл');
    expect(email.text).toContain('Бюджет: до 5000 лв');
    expect(email.text).toContain('Виж транскрипцията');
  });

  it('says plainly when nobody picked up', () => {
    const email = callReportEmail(
      {
        leadName: 'Иван',
        status: 'no_answer',
        call: { provider: 'vapi', state: 'ended', reached: false, summary: 'Клиентът не вдигна', qualification: 'unknown' },
      },
      'https://app.test/?lead=l_1',
    );
    expect(email.subject).toBe('Няма връзка с Иван: Не вдига');
    expect(email.text).toContain('Клиентът не вдигна');
    expect(email.text).not.toContain('Квалификация');
    expect(email.text).toContain('Отвори лийда');
  });
});
