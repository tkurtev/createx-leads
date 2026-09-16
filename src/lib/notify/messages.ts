import { fullDate } from '@/lib/format';
import { formatPhone } from '@/lib/leads/normalize';
import { QUALIFICATION_LABELS, STATUS_LABELS, type CallDetails, type LeadStatus } from '@/lib/leads/types';
import type { IntakeLead } from '@/lib/intake/schema';

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function render(title: string, rows: [string, string][], link: { href: string; label: string }) {
  const filled = rows.filter(([, value]) => value);
  const text = [title, '', ...filled.map(([k, v]) => `${k}: ${v}`), '', `${link.label}: ${link.href}`].join('\n');
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#0b0c22;max-width:520px">
<h2 style="margin:0 0 16px;font-size:18px">${escape(title)}</h2>
<table style="border-collapse:collapse;width:100%">${filled
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#5b5d73;vertical-align:top;white-space:nowrap">${escape(k)}</td><td style="padding:6px 0;white-space:pre-wrap">${escape(v)}</td></tr>`,
    )
    .join('')}</table>
<p style="margin:20px 0 0"><a href="${escape(link.href)}" style="display:inline-block;background:#2b58f8;color:#fff;text-decoration:none;padding:10px 18px;border-radius:999px;font-weight:bold">${escape(link.label)}</a></p>
</div>`;
  return { text, html };
}

export function leadUrl(appUrl: string, leadId: string) {
  return `${appUrl.replace(/\/$/, '')}/?lead=${encodeURIComponent(leadId)}`;
}

export function newLeadEmail(lead: IntakeLead, url: string) {
  return {
    subject: `Нов лийд: ${lead.name} (${formatPhone(lead.phone)})`,
    ...render(
      'Нов лийд от формата',
      [
        ['Име', lead.name],
        ['Телефон', formatPhone(lead.phone)],
        ['Имейл', lead.email ?? ''],
        ['Интерес', lead.interest],
        ['Съобщение', lead.message],
        ['Източник', lead.source],
      ],
      { href: url, label: 'Отвори лийда' },
    ),
  };
}

export type CallReport = { leadName: string; status?: LeadStatus; call: CallDetails };

const minutes = (seconds?: number) => (seconds ? `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')} мин.` : '');

export function callReportEmail({ leadName, status, call }: CallReport, url: string) {
  const heading = call.reached === false ? `Никой не вдигна: ${leadName}` : `AI агентът говори с ${leadName}`;
  const rows: [string, string][] = [
    ['Резултат', status ? STATUS_LABELS[status] : ''],
    ['Квалификация', call.qualification && call.qualification !== 'unknown' ? QUALIFICATION_LABELS[call.qualification] : ''],
    ['Продължителност', minutes(call.durationSec)],
    ['Обобщение', call.summary ?? ''],
    ['Следващи стъпки', (call.nextSteps ?? []).map((step) => `• ${step}`).join('\n')],
    ['Да потърсим', call.callbackAt ? fullDate(call.callbackAt) : ''],
    ...(call.facts ?? []).map((fact): [string, string] => [fact.label, fact.value]),
    ['Запис', call.recordingUrl ?? ''],
  ];

  return {
    subject: `${call.reached === false ? 'Няма връзка с' : 'AI обаждане до'} ${leadName}${status ? `: ${STATUS_LABELS[status]}` : ''}`,
    ...render(heading, rows, { href: url, label: call.transcript?.length ? 'Виж транскрипцията' : 'Отвори лийда' }),
  };
}
